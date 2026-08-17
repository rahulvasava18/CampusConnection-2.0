import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '@campusconnection/shared';

export const notificationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
    filter: z.enum(['ALL', 'UNREAD', ...NOTIFICATION_CATEGORIES]).default('ALL'),
  })
  .strict();

export const notificationIdParams = z
  .object({
    notificationId: z.string().regex(/^[a-f0-9]{24}$/i),
  })
  .strict();
