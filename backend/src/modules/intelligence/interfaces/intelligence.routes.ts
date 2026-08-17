import { Router, type Request } from 'express';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { validateRequest } from '../../../shared/validation/validate';
import { AppError } from '../../../shared/errors/app-error';
import { IntelligenceService } from '../application/intelligence.service';
import { feedbackBody, feedbackParams, recommendationQuery } from './intelligence.schemas';

function actor(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return { userId: req.auth.userId, accountState: req.auth.user.accountState };
}
function query(req: Request) {
  return req.query as unknown as { limit: number; cursor?: string };
}
function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}

export function createIntelligenceRouter(service = new IntelligenceService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/refresh', requireCsrf, async (req, res, next) => {
    try {
      await service.refreshRecommendations(actor(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  for (const [path, type] of [
    ['people', 'PEOPLE'],
    ['teams', 'TEAMS'],
    ['projects', 'PROJECTS'],
    ['communities', 'COMMUNITIES'],
  ] as const) {
    router.get(
      `/${path}`,
      validateRequest(recommendationQuery, 'query'),
      async (req, res, next) => {
        try {
          res.json(await service.getRecommendations(actor(req), type, query(req)));
        } catch (error) {
          next(error);
        }
      },
    );
  }
  router.post(
    '/:recommendationId/feedback',
    requireCsrf,
    validateRequest(feedbackParams, 'params'),
    validateRequest(feedbackBody, 'body'),
    async (req, res, next) => {
      try {
        await service.recordFeedback(
          actor(req),
          param(req, 'recommendationId'),
          req.body.feedback,
          req.body.recommendationType,
          req.correlationId,
        );
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
