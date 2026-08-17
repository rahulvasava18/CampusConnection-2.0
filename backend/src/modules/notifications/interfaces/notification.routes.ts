import { Router, type Request } from 'express';
import type { NotificationFilter } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { NotificationService } from '../application/notification.service';
import { notificationIdParams, notificationQuery } from './notification.schemas';

function actor(req: Request) {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return { userId: req.auth.userId, accountState: req.auth.user.accountState };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}

export function createNotificationRouter(service = new NotificationService()): Router {
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/notifications',
    validateRequest(notificationQuery, 'query'),
    async (req, res, next) => {
      try {
        res.json({
          data: await service.list(
            actor(req),
            req.query as unknown as { limit: number; cursor?: string; filter: NotificationFilter },
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/notifications/unread-count', async (req, res, next) => {
    try {
      res.json({ data: await service.unreadCount(actor(req)) });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    '/notifications/:notificationId/read',
    requireCsrf,
    validateRequest(notificationIdParams, 'params'),
    async (req, res, next) => {
      try {
        res.json({ data: await service.markRead(actor(req), param(req, 'notificationId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post('/notifications/read-all', requireCsrf, async (req, res, next) => {
    try {
      res.json({ data: await service.markAllRead(actor(req)) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
