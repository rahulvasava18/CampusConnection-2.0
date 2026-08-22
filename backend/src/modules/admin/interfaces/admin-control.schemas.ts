import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
const reportReasons = ['SPAM', 'HARASSMENT', 'ABUSE', 'MISLEADING_INFORMATION', 'IMPERSONATION', 'SCAM', 'INAPPROPRIATE_CONTENT', 'OTHER'] as const;
const targetTypes = ['USER', 'POST', 'COMMENT', 'TEAM', 'COMMUNITY', 'EVENT'] as const;

export const reportCreateSchema = z.object({
  targetType: z.enum(targetTypes),
  targetId: objectId,
  reason: z.enum(reportReasons),
  description: z.string().trim().max(2000).optional(),
});
export const reportIdParamsSchema = z.object({ reportId: objectId });
export const reportQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  reason: z.enum(reportReasons).optional(),
  targetType: z.enum(targetTypes).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['createdAt', 'priority', 'reports']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const reportReviewSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
  reason: z.string().trim().max(1000).optional(),
});
export const reportResolutionSchema = z.object({ reason: z.string().trim().min(1).max(1000) });

export const contentTypeParamsSchema = z.object({ targetType: z.enum(['POST', 'COMMENT', 'TEAM', 'COMMUNITY', 'EVENT']) });
export const contentIdParamsSchema = z.object({ targetType: z.enum(['POST', 'COMMENT', 'TEAM', 'COMMUNITY', 'EVENT']), contentId: objectId });
export const contentQuerySchema = z.object({ search: z.string().trim().max(120).optional(), status: z.string().trim().max(40).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const contentActionSchema = z.object({ action: z.enum(['HIDE', 'DELETE', 'RESTORE', 'DISABLE', 'CANCEL']), reason: z.string().trim().min(1).max(1000), confirmation: z.string().optional() });

export const adminAuditQuerySchema = z.object({ search: z.string().trim().max(120).optional(), action: z.string().trim().max(80).optional(), targetType: z.string().trim().max(40).optional(), dateFrom: z.string().datetime({ offset: true }).optional(), dateTo: z.string().datetime({ offset: true }).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const auditIdParamsSchema = z.object({ auditId: objectId });
export const adminNotificationQuerySchema = z.object({ unread: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const notificationIdParamsSchema = z.object({ notificationId: objectId });
export const analyticsQuerySchema = z.object({ range: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d') });
