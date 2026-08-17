import { z } from 'zod';
import { RECOMMENDATION_TYPES } from '@campusconnection/shared';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
export const recommendationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
  })
  .strict();
export const feedbackParams = z.object({ recommendationId: objectId }).strict();
export const feedbackBody = z
  .object({
    recommendationType: z.enum(RECOMMENDATION_TYPES),
    feedback: z.enum(['DISMISS', 'NOT_RELEVANT', 'HELPFUL']),
  })
  .strict();
