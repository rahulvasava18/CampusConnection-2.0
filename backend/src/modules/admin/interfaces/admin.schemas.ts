import { z } from 'zod';

export const adminStatsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '6m', '1y']).default('30d'),
});

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');

export const adminUsersQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'RESTRICTED', 'SUSPENDED', 'BANNED', 'DELETED']).optional(),
    college: z.string().trim().max(160).optional(),
    activity: z.enum(['all', 'recent', 'inactive']).default('all'),
    reports: z.enum(['any', 'reported', 'frequent']).default('any'),
    joined: z.enum(['today', '7d', '30d', '90d']).optional(),
    sort: z.enum(['createdAt', 'lastActive', 'activity', 'reports']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().refine((value) => [25, 50, 100].includes(value), 'Limit must be 25, 50, or 100.').default(25),
  })
  .strict();

export const adminUserIdParamsSchema = z.object({ userId: objectId }).strict();

export const adminWarningSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
    relatedContentId: objectId.optional(),
    notifyUser: z.boolean().default(true),
  })
  .strict();

export const adminSuspensionSchema = z
  .object({
    duration: z.enum(['24h', '3d', '7d', '30d', 'indefinite']),
    reason: z.string().trim().min(1).max(500),
    notifyUser: z.boolean().default(true),
  })
  .strict();

export const adminBanSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
    confirmation: z.literal('BAN'),
    notifyUser: z.boolean().default(true),
  })
  .strict();

export const adminRestoreSchema = z.object({ notifyUser: z.boolean().default(true) }).strict();

export const adminDeleteSchema = z
  .object({ reason: z.string().trim().min(1).max(500), confirmation: z.literal('DELETE') })
  .strict();
