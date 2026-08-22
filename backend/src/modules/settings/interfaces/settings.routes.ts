import { Router, type Request } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { getEnv } from '../../../config/env';
import { clearPasswordResetCookie, parseCookies } from '../../../shared/http/cookies';
import { SettingsService } from '../application/settings.service';
import { passwordRecoveryUpdate, passwordUpdate, settingsUpdate } from './settings.schemas';

function context(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return req.auth;
}

export function createSettingsRouter(service = new SettingsService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/settings', async (req, res, next) => {
    try {
      res.json({ data: await service.get(context(req)) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    '/settings',
    requireCsrf,
    validateRequest(settingsUpdate, 'body'),
    async (req, res, next) => {
      try {
        res.json({ data: await service.update(context(req), req.body, req.correlationId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/settings/password',
    requireCsrf,
    validateRequest(passwordUpdate, 'body'),
    async (req, res, next) => {
      try {
        res.json({
          data: await service.setPassword(context(req), req.body, req.correlationId),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/settings/password/recovery',
    requireCsrf,
    validateRequest(passwordRecoveryUpdate, 'body'),
    async (req, res, next) => {
      try {
        const resetToken = parseCookies(req.header('cookie'))[getEnv().passwordResetCookieName];
        const result = await service.setPasswordWithRecovery(
          context(req),
          req.body,
          resetToken,
          req.correlationId,
        );
        clearPasswordResetCookie(res);
        res.json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
