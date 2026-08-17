import { Router, type Request } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { SettingsService } from '../application/settings.service';
import { settingsUpdate } from './settings.schemas';

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
  return router;
}
