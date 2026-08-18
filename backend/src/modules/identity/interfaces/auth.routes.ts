import { Router, type Request } from 'express';
import type { AuthService } from '../application/auth.service';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../security/auth.middleware';
import { requireCsrf } from '../security/csrf.middleware';
import { clearAuthCookies, parseCookies, setAuthCookies } from '../../../shared/http/cookies';
import { getEnv } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';
import {
  loginSchema,
  googleExchangeSchema,
  googleOnboardingSchema,
  googleUsernameAvailabilitySchema,
  profileUpdateSchema,
  resendVerificationSchema,
  sessionParamsSchema,
  signupSchema,
  verifyEmailSchema,
} from './auth.schemas';
import type { RequestMeta } from './auth.types';

function requestMeta(req: Request): RequestMeta {
  return {
    requestId: req.requestId,
    correlationId: req.correlationId,
    ...(req.ip ? { ipAddress: req.ip } : {}),
    ...(req.get('user-agent') ? { userAgent: req.get('user-agent')! } : {}),
  };
}

function requireRequestAuth(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return req.auth;
}

function sendSession(
  res: Parameters<typeof setAuthCookies>[0],
  result: {
    user: unknown;
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
    sessionId: string;
  },
) {
  setAuthCookies(res, result.refreshToken, result.csrfToken);
  return {
    data: { user: result.user, accessToken: result.accessToken, sessionId: result.sessionId },
  };
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.get('/google', async (_req, res, next) => {
    try {
      res.redirect(302, await authService.startGoogleAuthorization());
    } catch (error) {
      next(error);
    }
  });
  router.get('/google/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const frontendUrl = getEnv().FRONTEND_URL.replace(/\/$/, '');
    if (!code || !state) {
      res.redirect(303, `${frontendUrl}/login?googleError=1`);
      return;
    }
    try {
      res.redirect(303, await authService.completeGoogleCallback(code, state));
    } catch {
      res.redirect(303, `${frontendUrl}/login?googleError=1`);
    }
  });
  router.post(
    '/google/exchange',
    validateRequest(googleExchangeSchema, 'body'),
    async (req, res, next) => {
      try {
        const result = await authService.exchangeGoogleCode(req.body.code, requestMeta(req));
        if (result.onboardingRequired) {
          res.status(200).json({ data: result });
          return;
        }
        res.status(200).json(sendSession(res, result));
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/google/onboarding/username-availability',
    validateRequest(googleUsernameAvailabilitySchema, 'body'),
    async (req, res, next) => {
      try {
        res.status(200).json({
          data: await authService.isGoogleUsernameAvailable(
            req.body.onboardingToken,
            req.body.username,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/google/onboarding',
    validateRequest(googleOnboardingSchema, 'body'),
    async (req, res, next) => {
      try {
        res.status(201).json(sendSession(res, await authService.completeGoogleOnboarding(req.body, requestMeta(req))));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post('/signup', validateRequest(signupSchema, 'body'), (_req, _res, next) => {
    next(
      new AppError(
        'GOOGLE_SIGNUP_REQUIRED',
        'New accounts must be created with Google Sign-In.',
        410,
      ),
    );
  });
  router.post(
    '/verify-email',
    validateRequest(verifyEmailSchema, 'body'),
    async (req, res, next) => {
      try {
        await authService.verifyEmail(req.body.token, requestMeta(req));
        res.status(200).json({ data: { verified: true } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/resend-verification',
    validateRequest(resendVerificationSchema, 'body'),
    async (req, res, next) => {
      try {
        const result = await authService.resendVerification(req.body.identifier, requestMeta(req));
        res.status(200).json({ data: { email: result.email, verificationRequired: true } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post('/login', validateRequest(loginSchema, 'body'), async (req, res, next) => {
    try {
      res
        .status(200)
        .json(
          sendSession(
            res,
            await authService.login(req.body.identifier, req.body.password, requestMeta(req)),
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', requireCsrf, async (req, res, next) => {
    try {
      const token = parseCookies(req.header('cookie'))[getEnv().refreshCookieName];
      res.status(200).json(sendSession(res, await authService.refresh(token, requestMeta(req))));
    } catch (error) {
      next(error);
    }
  });
  router.post('/logout', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      await authService.logout(requireRequestAuth(req), requestMeta(req));
      clearAuthCookies(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.post('/logout-all', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      await authService.logoutAll(requireRequestAuth(req), requestMeta(req));
      clearAuthCookies(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createMeRouter(authService: AuthService): Router {
  const router = Router();
  router.get('/me', requireAuth, (req, res) =>
    res.status(200).json({ data: { user: requireRequestAuth(req).user } }),
  );
  router.patch(
    '/me',
    requireAuth,
    validateRequest(profileUpdateSchema, 'body'),
    async (req, res, next) => {
      try {
        res.status(200).json({
          data: {
            user: await authService.updateProfile(
              requireRequestAuth(req),
              req.body,
              requestMeta(req),
            ),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/me/sessions', requireAuth, async (req, res, next) => {
    try {
      res.status(200).json({ data: await authService.listSessions(requireRequestAuth(req)) });
    } catch (error) {
      next(error);
    }
  });
  router.delete(
    '/me/sessions/:sessionId',
    requireAuth,
    validateRequest(sessionParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        const sessionId = Array.isArray(req.params.sessionId)
          ? req.params.sessionId[0]
          : req.params.sessionId;
        if (!sessionId) throw new AppError('SESSION_NOT_FOUND', 'The session was not found.', 404);
        await authService.revokeSession(requireRequestAuth(req), sessionId, requestMeta(req));
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  router.post('/me/sessions/revoke-all', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      await authService.logoutAll(requireRequestAuth(req), requestMeta(req));
      clearAuthCookies(res);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.post('/me/sessions/revoke-others', requireAuth, requireCsrf, async (req, res, next) => {
    try {
      res.status(200).json({
        data: {
          revokedCount: await authService.revokeOtherSessions(
            requireRequestAuth(req),
            requestMeta(req),
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
