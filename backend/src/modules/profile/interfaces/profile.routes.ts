import { Router, type Request } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../../identity/security/auth.middleware';
import { ProfileService } from '../application/profile.service';
import { profileIdParams, profileQuery } from './profile.schemas';

function actor(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return {
    userId: req.auth.userId,
    accountState: req.auth.user.accountState,
    roles: req.auth.roles,
  };
}

export function createProfileRouter(service = new ProfileService()): Router {
  const router = Router();
  router.get(
    '/users/:userId/profile',
    requireAuth,
    validateRequest(profileIdParams, 'params'),
    validateRequest(profileQuery, 'query'),
    async (req, res, next) => {
      try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        if (!userId) throw new AppError('RESOURCE_NOT_FOUND', 'The profile was not found.', 404);
        res.json({
          data: await service.get(
            actor(req),
            userId,
            req.query as unknown as { limit: number; cursor?: string },
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
