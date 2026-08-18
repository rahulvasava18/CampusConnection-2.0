import type { Server } from 'socket.io';
import type Redis from 'ioredis';
import type { MessageView } from '@campusconnection/shared';
import { getRedisClient } from '../../../infrastructure/redis/client';
import { logger } from '../../../shared/logging/logger';

const channel = 'campusconnection:realtime-control';
export type RealtimeControlEvent =
  | { type: 'user-account-deleted'; userId: string }
  | {
      type:
        | 'conversation-member-added'
        | 'conversation-member-removed'
        | 'conversation-member-left'
        | 'message-updated'
        | 'message-deleted';
      conversationId: string;
      userId?: string;
      message?: MessageView;
      messageId?: string;
    };

export async function publishRealtimeControl(event: RealtimeControlEvent): Promise<void> {
  try {
    await getRedisClient().publish(channel, JSON.stringify(event));
  } catch (error) {
    logger.warn({ err: error, eventType: event.type }, 'Realtime control publish unavailable');
  }
}

export async function subscribeRealtimeControl(
  redis: Redis,
  io: Server,
): Promise<() => Promise<void>> {
  const subscriber = redis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(channel);
  subscriber.on('message', (topic, raw) => {
    if (topic !== channel) return;
    try {
      const event = JSON.parse(raw) as RealtimeControlEvent;
      if (event.type === 'user-account-deleted' && event.userId) {
        void io
          .fetchSockets()
          .then((sockets) =>
            Promise.all(
              sockets
                .filter((socket) => socket.data.userId === event.userId)
                .map((socket) => socket.disconnect(true)),
            ),
          );
        return;
      }
      if (!('conversationId' in event) || !event.conversationId) return;
      if (event.type === 'message-updated' && event.message) {
        io.to(`conversation:${event.conversationId}`).emit('message:updated', event.message);
        return;
      }
      if (event.type === 'message-deleted' && event.message) {
        io.to(`conversation:${event.conversationId}`).emit('message:deleted', event.message);
        return;
      }
      if (!event.userId) return;
      void io
        .in(`conversation:${event.conversationId}`)
        .fetchSockets()
        .then((sockets) =>
          Promise.all(
            sockets
              .filter((socket) => socket.data.userId === event.userId)
              .map((socket) => socket.leave(`conversation:${event.conversationId}`)),
          ),
        );
    } catch (error) {
      logger.warn({ err: error }, 'Invalid realtime control event');
    }
  });
  return async () => {
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  };
}
