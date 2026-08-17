import { z } from 'zod';
import { POST_TYPES, VISIBILITIES } from '@campusconnection/shared';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
export const postIdParams = z.object({ postId: objectId }).strict();
export const commentIdParams = z.object({ commentId: objectId }).strict();
export const userIdParams = z.object({ userId: objectId }).strict();
export const requestIdParams = z.object({ requestId: objectId }).strict();
export const postCreateSchema = z
  .object({
    type: z.enum(POST_TYPES),
    content: z.string().trim().min(1).max(5000),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
    communityId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    link: z.string().url().max(500).optional(),
    visibility: z.enum(VISIBILITIES).default('PUBLIC'),
    mediaAssetIds: z.array(z.string().trim().min(1).max(200)).max(4).default([]),
  })
  .strict();
export const postUpdateSchema = postCreateSchema.omit({ communityId: true }).partial().strict();
export const communityPostParams = z.object({ communityId: objectId }).strict();
export const commentCreateSchema = z
  .object({ content: z.string().trim().min(1).max(2000), parentCommentId: objectId.optional() })
  .strict();
export const commentUpdateSchema = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();
export const reactionParams = z
  .object({ postId: objectId, reactionType: z.literal('LIKE') })
  .strict();
export const commentReactionParams = z
  .object({ commentId: objectId, reactionType: z.literal('LIKE') })
  .strict();
export const paginationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
    mode: z.enum(['personalized', 'chronological']).default('personalized'),
  })
  .strict();
export const requestQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
    direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  })
  .strict();
