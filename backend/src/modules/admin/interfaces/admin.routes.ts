import { Router, type Request } from 'express';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth, requireRole } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { AppError } from '../../../shared/errors/app-error';
import { AdminUserService } from '../application/admin-user.service';
import { AdminService } from '../application/admin.service';
import {
  adminBanSchema,
  adminDeleteSchema,
  adminRestoreSchema,
  adminSuspensionSchema,
  adminStatsQuerySchema,
  adminUserIdParamsSchema,
  adminUsersQuerySchema,
  adminWarningSchema,
} from './admin.schemas';
import type { AdminStatsRange } from '../application/admin.service';

function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}

export function createAdminRouter(
  adminService = new AdminService(),
  adminUserService = new AdminUserService(),
): Router {
  const router = Router();
  router.use(requireAuth, requireRole('PLATFORM_ADMIN'));
  router.get('/stats', validateRequest(adminStatsQuerySchema, 'query'), async (req, res, next) => {
    try {
      res.status(200).json({ data: await adminService.getStats(req.query.range as AdminStatsRange) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/users', validateRequest(adminUsersQuerySchema, 'query'), async (req, res, next) => {
    try {
      res.status(200).json({ data: await adminUserService.listUsers(req.query as never) });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/users/:userId',
    validateRequest(adminUserIdParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        res.status(200).json({ data: await adminUserService.getUserOverview(param(req, 'userId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/users/:userId/activity',
    validateRequest(adminUserIdParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        res.status(200).json({ data: await adminUserService.getActivity(param(req, 'userId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/users/:userId/content',
    validateRequest(adminUserIdParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        res.status(200).json({ data: await adminUserService.getContent(param(req, 'userId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/users/:userId/reports',
    validateRequest(adminUserIdParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        res.status(200).json({ data: await adminUserService.getReports(param(req, 'userId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/users/:userId/moderation-history',
    validateRequest(adminUserIdParamsSchema, 'params'),
    async (req, res, next) => {
      try {
        res.status(200).json({ data: await adminUserService.getModerationHistory(param(req, 'userId')) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/warn',
    requireCsrf,
    validateRequest(adminUserIdParamsSchema, 'params'),
    validateRequest(adminWarningSchema, 'body'),
    async (req, res, next) => {
      try {
        if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
        res.status(200).json({ data: await adminUserService.warn(req.auth.userId, param(req, 'userId'), req.body, req.requestId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/suspend',
    requireCsrf,
    validateRequest(adminUserIdParamsSchema, 'params'),
    validateRequest(adminSuspensionSchema, 'body'),
    async (req, res, next) => {
      try {
        if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
        res.status(200).json({ data: await adminUserService.suspend(req.auth.userId, param(req, 'userId'), req.body, req.requestId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/ban',
    requireCsrf,
    validateRequest(adminUserIdParamsSchema, 'params'),
    validateRequest(adminBanSchema, 'body'),
    async (req, res, next) => {
      try {
        if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
        res.status(200).json({ data: await adminUserService.ban(req.auth.userId, param(req, 'userId'), req.body, req.requestId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/users/:userId/restore',
    requireCsrf,
    validateRequest(adminUserIdParamsSchema, 'params'),
    validateRequest(adminRestoreSchema, 'body'),
    async (req, res, next) => {
      try {
        if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
        res.status(200).json({ data: await adminUserService.restore(req.auth.userId, param(req, 'userId'), req.body, req.requestId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.delete(
    '/users/:userId',
    requireCsrf,
    validateRequest(adminUserIdParamsSchema, 'params'),
    validateRequest(adminDeleteSchema, 'body'),
    async (req, res, next) => {
      try {
        if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
        res.status(200).json({ data: await adminUserService.softDelete(req.auth.userId, param(req, 'userId'), req.body.reason, req.requestId) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
