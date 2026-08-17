import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { z } from 'zod';
import type {
  MessageAcknowledgement,
  MessageSendPayload,
  PresenceUpdate,
  SocketErrorPayload,
  TypingUpdate,
} from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import {
  realtimeRateRule,
  RedisRateLimiter,
} from '../../../infrastructure/rate-limit/redis-rate-limiter';
import { CommunicationService } from '../application/communication.service';
import { PresenceManager } from './presence';

const conversationPayload = z
  .object({ conversationId: z.string().regex(/^[a-f0-9]{24}$/i) })
  .strict();
const messagePayload = z
  .object({
    conversationId: z.string().regex(/^[a-f0-9]{24}$/i),
    clientMessageId: z.string().trim().min(8).max(100),
    content: z.string().trim().min(1).max(5000),
    messageType: z.enum(['TEXT', 'SYSTEM']).default('TEXT'),
    replyToMessageId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
  })
  .strict();
const readPayload = z
  .object({
    conversationId: z.string().regex(/^[a-f0-9]{24}$/i),
    messageId: z.string().regex(/^[a-f0-9]{24}$/i),
  })
  .strict();
const typingPayload = z.object({ conversationId: z.string().regex(/^[a-f0-9]{24}$/i) }).strict();
type AuthenticatedSocket = Socket & {
  data: { userId: string; sessionId: string; roles: string[] };
};
type Ack<T> = (payload: T) => void;

function room(conversationId: string) {
  return `conversation:${conversationId}`;
}
function socketActor(socket: AuthenticatedSocket) {
  return { userId: socket.data.userId, accountState: 'ACTIVE', roles: socket.data.roles };
}
function errorPayload(error: unknown): SocketErrorPayload {
  if (error instanceof AppError)
    return { code: error.code, message: error.message, requestId: randomUUID() };
  return {
    code: 'INTERNAL_ERROR',
    message: 'The realtime operation failed.',
    requestId: randomUUID(),
  };
}

export function createRealtimeGateway(
  io: Server,
  redis: Redis,
  service = new CommunicationService(),
  limiter = new RedisRateLimiter(redis),
): { close: () => void } {
  const presence = new PresenceManager(redis);
  const typingTimers = new Map<string, NodeJS.Timeout>();
  const typingKey = (socketId: string, conversationId: string) => `${socketId}:${conversationId}`;
  const clearTyping = (socket: AuthenticatedSocket, conversationId: string) => {
    const key = typingKey(socket.id, conversationId);
    const timer = typingTimers.get(key);
    if (timer) clearTimeout(timer);
    typingTimers.delete(key);
    io.to(room(conversationId))
      .except(socket.id)
      .emit('typing:update', {
        conversationId,
        userId: socket.data.userId,
        isTyping: false,
      } satisfies TypingUpdate);
  };
  const reject = (ack: Ack<unknown> | undefined, error: unknown) => {
    if (ack) ack({ status: 'failed', error: errorPayload(error) });
  };

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;
    void presence
      .online(userId, socket.id)
      .then(() => {
        socket.emit('connection:ready', {
          socketId: socket.id,
          userId,
          serverTime: new Date().toISOString(),
        });
      })
      .catch(() => undefined);
    const heartbeat = setInterval(() => {
      void presence.heartbeat(userId, socket.id);
      for (const conversationRoom of socket.rooms)
        if (conversationRoom.startsWith('conversation:'))
          void presence.heartbeatViewing(conversationRoom.slice('conversation:'.length), userId);
    }, presence.heartbeatIntervalMs());
    socket.on(
      'conversation:join',
      async (
        payload: unknown,
        ack?: Ack<{ conversationId: string } | { status: string; error: SocketErrorPayload }>,
      ) => {
        try {
          const input = conversationPayload.parse(payload);
          await service.getConversation(socketActor(socket), input.conversationId);
          await socket.join(room(input.conversationId));
          await presence.viewing(input.conversationId, userId);
          const members = await service.listMembers(socketActor(socket), input.conversationId);
          for (const member of members.data)
            socket.emit('presence:update', {
              userId: member.userId,
              state: (await presence.isOnline(member.userId)) ? 'online' : 'offline',
              updatedAt: new Date().toISOString(),
            } satisfies PresenceUpdate);
          socket.emit('conversation:joined', input);
          if (ack) ack(input);
        } catch (error) {
          reject(ack as unknown as Ack<unknown>, error);
        }
      },
    );
    socket.on(
      'conversation:leave',
      async (
        payload: unknown,
        ack?: Ack<{ conversationId: string } | { status: string; error: SocketErrorPayload }>,
      ) => {
        try {
          const input = conversationPayload.parse(payload);
          clearTyping(socket, input.conversationId);
          await presence.stopViewing(input.conversationId, userId);
          await socket.leave(room(input.conversationId));
          socket.emit('conversation:left', input);
          if (ack) ack(input);
        } catch (error) {
          reject(ack as unknown as Ack<unknown>, error);
        }
      },
    );
    socket.on('message:send', async (payload: unknown, ack?: Ack<MessageAcknowledgement>) => {
      try {
        const parsed = messagePayload.parse(payload);
        const input: MessageSendPayload = {
          conversationId: parsed.conversationId,
          clientMessageId: parsed.clientMessageId,
          content: parsed.content,
          messageType: parsed.messageType,
          ...(parsed.replyToMessageId ? { replyToMessageId: parsed.replyToMessageId } : {}),
        };
        const rule = await limiter.consume(`socket:message:${userId}`, realtimeRateRule('message'));
        if (!rule.allowed)
          throw new AppError('RATE_LIMITED', 'Too many messages. Try again later.', 429, {
            retryAfterSeconds: rule.retryAfterSeconds,
          });
        const result = await service.sendMessage(
          { ...input, senderId: userId, messageType: input.messageType ?? 'TEXT' },
          randomUUID(),
        );
        const acknowledgement: MessageAcknowledgement = {
          clientMessageId: input.clientMessageId,
          messageId: result.message.id,
          status: result.duplicate ? 'duplicate' : 'persisted',
          serverTimestamp: result.message.createdAt,
        };
        if (ack) ack(acknowledgement);
        if (!result.duplicate)
          io.to(room(input.conversationId)).emit('message:new', result.message);
      } catch (error) {
        reject(ack as unknown as Ack<unknown>, error);
      }
    });
    socket.on('message:read', async (payload: unknown, ack?: Ack<unknown>) => {
      try {
        const input = readPayload.parse(payload);
        await service.getConversation(socketActor(socket), input.conversationId);
        const state = await service.markRead(
          socketActor(socket),
          input.conversationId,
          input.messageId,
          randomUUID(),
        );
        io.to(room(input.conversationId)).emit('message:read', { ...state, userId });
        if (ack) ack(state);
      } catch (error) {
        reject(ack, error);
      }
    });
    const startTyping = async (payload: unknown, ack?: Ack<unknown>) => {
      try {
        const input = typingPayload.parse(payload);
        const rule = await limiter.consume(`socket:typing:${userId}`, realtimeRateRule('typing'));
        if (!rule.allowed)
          throw new AppError('RATE_LIMITED', 'Typing updates are rate limited.', 429);
        await service.getConversation(socketActor(socket), input.conversationId);
        const key = typingKey(socket.id, input.conversationId);
        const old = typingTimers.get(key);
        if (old) clearTimeout(old);
        const expiresAt = new Date(Date.now() + 10000).toISOString();
        io.to(room(input.conversationId))
          .except(socket.id)
          .emit('typing:update', {
            conversationId: input.conversationId,
            userId,
            isTyping: true,
            expiresAt,
          } satisfies TypingUpdate);
        typingTimers.set(
          key,
          setTimeout(() => clearTyping(socket, input.conversationId), 10000),
        );
        if (ack) ack({ ok: true });
      } catch (error) {
        reject(ack, error);
      }
    };
    socket.on('typing:start', startTyping);
    socket.on('typing:stop', async (payload: unknown, ack?: Ack<unknown>) => {
      try {
        const input = typingPayload.parse(payload);
        await service.getConversation(socketActor(socket), input.conversationId);
        clearTyping(socket, input.conversationId);
        if (ack) ack({ ok: true });
      } catch (error) {
        reject(ack, error);
      }
    });
    socket.on('disconnect', () => {
      clearInterval(heartbeat);
      for (const key of [...typingTimers.keys()])
        if (key.startsWith(`${socket.id}:`)) typingTimers.delete(key);
      void presence
        .offline(userId, socket.id)
        .then((stillOnline) => {
          if (!stillOnline) {
            const update: PresenceUpdate = {
              userId,
              state: 'offline',
              updatedAt: new Date().toISOString(),
            };
            for (const conversationRoom of socket.rooms)
              if (conversationRoom.startsWith('conversation:'))
                io.to(conversationRoom).emit('presence:update', update);
          }
        })
        .catch(() => undefined);
      for (const conversationRoom of socket.rooms)
        if (conversationRoom.startsWith('conversation:'))
          void presence.stopViewing(conversationRoom.slice('conversation:'.length), userId);
    });
  });
  return {
    close: () => {
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
    },
  };
}
