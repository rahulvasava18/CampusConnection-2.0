import { z } from 'zod';
import { CONVERSATION_TYPES, MESSAGE_TYPES } from '@campusconnection/shared';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
const pagination = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(1000).optional(),
  })
  .strict();
export const conversationPagination = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
  })
  .strict();
export const conversationIdParams = z.object({ conversationId: objectId }).strict();
export const messageIdParams = z.object({ messageId: objectId }).strict();
export const memberParams = z.object({ conversationId: objectId, userId: objectId }).strict();
export const conversationCreate = z.discriminatedUnion('type', [
  z.object({ type: z.literal('DIRECT'), targetUserId: objectId }).strict(),
  z
    .object({
      type: z.literal('GROUP'),
      title: z.string().trim().min(1).max(160),
      memberIds: z.array(objectId).max(100).default([]),
    })
    .strict(),
  z
    .object({
      type: z.literal('TEAM'),
      teamId: objectId,
      title: z.string().trim().max(160).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('COMMUNITY'),
      communityId: objectId,
      title: z.string().trim().max(160).optional(),
    })
    .strict(),
]);
export const conversationUpdate = z.object({ title: z.string().trim().min(1).max(160) }).strict();
export const memberCreate = z.object({ userId: objectId }).strict();
export const messageCreate = z
  .object({
    conversationId: objectId,
    clientMessageId: z.string().trim().min(8).max(100),
    content: z.string().trim().min(1).max(5000),
    messageType: z.enum(MESSAGE_TYPES).default('TEXT'),
    replyToMessageId: objectId.optional(),
  })
  .strict();
export const messageUpdate = z.object({ content: z.string().trim().min(1).max(5000) }).strict();
export const readCreate = z.object({ messageId: objectId }).strict();
export const messagePagination = pagination;
export const conversationTypes = CONVERSATION_TYPES;
