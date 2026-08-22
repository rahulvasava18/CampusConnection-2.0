import { Router, type Request } from 'express';
import { AppError } from '../../../shared/errors/app-error';
import { validateRequest } from '../../../shared/validation/validate';
import { requireAuth, requireRole } from '../../identity/security/auth.middleware';
import { requireCsrf } from '../../identity/security/csrf.middleware';
import { AdminAnalyticsService } from '../application/admin-analytics.service';
import { AdminControlService } from '../application/admin-control.service';
import {
  adminAuditQuerySchema,
  adminNotificationQuerySchema,
  analyticsQuerySchema,
  auditIdParamsSchema,
  contentActionSchema,
  contentIdParamsSchema,
  contentQuerySchema,
  contentTypeParamsSchema,
  notificationIdParamsSchema,
  reportCreateSchema,
  reportIdParamsSchema,
  reportQuerySchema,
  reportResolutionSchema,
  reportReviewSchema,
} from './admin-control.schemas';

function actor(req: Request): string {
  if (!req.auth) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
  return req.auth.userId;
}
function param(req: Request, name: string): string {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new AppError('VALIDATION_ERROR', `Missing route parameter: ${name}`, 422);
  return result;
}
function adminMutation(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Parameters<NonNullable<Parameters<Router['post']>[1]>>[1], next: Parameters<NonNullable<Parameters<Router['post']>[1]>>[2]) => {
    try { res.status(200).json({ data: await handler(req) }); } catch (error) { next(error); }
  };
}

export function createReportRouter(service = new AdminControlService()): Router {
  const router = Router();
  router.post('/reports', requireAuth, requireCsrf, validateRequest(reportCreateSchema, 'body'), async (req, res, next) => {
    try { res.status(201).json({ data: await service.createReport(actor(req), req.body) }); } catch (error) { next(error); }
  });
  return router;
}

export function createAdminControlRouter(service = new AdminControlService(), analytics = new AdminAnalyticsService()): Router {
  const router = Router();
  router.use(requireAuth, requireRole('PLATFORM_ADMIN'));
  router.get('/reports', validateRequest(reportQuerySchema, 'query'), async (req, res, next) => {
    try { res.json({ data: await service.listReports(req.query as never) }); } catch (error) { next(error); }
  });
  router.get('/reports/:reportId', validateRequest(reportIdParamsSchema, 'params'), async (req, res, next) => {
    try { res.json({ data: await service.getReport(param(req, 'reportId')) }); } catch (error) { next(error); }
  });
  router.patch('/reports/:reportId', requireCsrf, validateRequest(reportIdParamsSchema, 'params'), validateRequest(reportReviewSchema, 'body'), adminMutation(async (req) => service.reviewReport(actor(req), param(req, 'reportId'), req.body.status, req.body.reason)));
  router.post('/reports/:reportId/resolve', requireCsrf, validateRequest(reportIdParamsSchema, 'params'), validateRequest(reportResolutionSchema, 'body'), adminMutation(async (req) => service.reviewReport(actor(req), param(req, 'reportId'), 'RESOLVED', req.body.reason)));
  router.post('/reports/:reportId/dismiss', requireCsrf, validateRequest(reportIdParamsSchema, 'params'), validateRequest(reportResolutionSchema, 'body'), adminMutation(async (req) => service.reviewReport(actor(req), param(req, 'reportId'), 'DISMISSED', req.body.reason)));

  router.get('/content/:targetType', validateRequest(contentTypeParamsSchema, 'params'), validateRequest(contentQuerySchema, 'query'), async (req, res, next) => {
    try { res.json({ data: await service.listContent({ ...(req.query as unknown as { search?: string; status?: string; page: number; limit: number }), targetType: param(req, 'targetType') as 'POST' | 'COMMENT' | 'TEAM' | 'COMMUNITY' | 'EVENT' }) }); } catch (error) { next(error); }
  });
  router.post('/content/:targetType/:contentId/moderate', requireCsrf, validateRequest(contentIdParamsSchema, 'params'), validateRequest(contentActionSchema, 'body'), adminMutation(async (req) => {
    const input = req.body as { action: 'HIDE' | 'DELETE' | 'RESTORE' | 'DISABLE' | 'CANCEL'; reason: string; confirmation?: string };
    if (['DELETE'].includes(input.action) && input.confirmation !== 'DELETE') throw new AppError('CONFIRMATION_REQUIRED', 'Type DELETE to confirm this action.', 422);
    return service.moderateContent(actor(req), req.params.targetType as never, param(req, 'contentId'), input.action, input.reason);
  }));
  router.get('/audit-logs', validateRequest(adminAuditQuerySchema, 'query'), async (req, res, next) => {
    try { res.json({ data: await service.listAudit(req.query as never) }); } catch (error) { next(error); }
  });
  router.get('/audit-logs/:auditId', validateRequest(auditIdParamsSchema, 'params'), async (req, res, next) => {
    try { res.json({ data: await service.getAudit(param(req, 'auditId')) }); } catch (error) { next(error); }
  });
  router.get('/notifications', validateRequest(adminNotificationQuerySchema, 'query'), async (req, res, next) => {
    try { res.json({ data: await service.listAdminNotifications(actor(req), req.query as never) }); } catch (error) { next(error); }
  });
  router.get('/notifications/unread-count', async (req, res, next) => {
    try { const data = await service.listAdminNotifications(actor(req), { unread: true, page: 1, limit: 1 }); res.json({ data: { unreadCount: data.unreadCount } }); } catch (error) { next(error); }
  });
  router.patch('/notifications/:notificationId/read', requireCsrf, validateRequest(notificationIdParamsSchema, 'params'), adminMutation(async (req) => service.markAdminNotificationRead(actor(req), param(req, 'notificationId'))));
  router.post('/notifications/read-all', requireCsrf, adminMutation(async (req) => service.markAllAdminNotificationsRead(actor(req))));
  router.get('/analytics', validateRequest(analyticsQuerySchema, 'query'), async (req, res, next) => {
    try { res.json({ data: await analytics.getAnalytics(req.query.range as never) }); } catch (error) { next(error); }
  });
  router.get('/moderation', async (_req, res, next) => {
    try { res.json({ data: await service.suspiciousActivity() }); } catch (error) { next(error); }
  });
  return router;
}
