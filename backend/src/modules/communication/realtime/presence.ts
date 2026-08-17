import type Redis from 'ioredis';
import { getEnv } from '../../../config/env';

export function conversationPresenceKey(conversationId: string, userId: string) {
  return `presence:conversation:${conversationId}:${userId}`;
}

export class PresenceManager {
  private readonly ttl: number;
  public constructor(private readonly redis: Redis) {
    this.ttl = getEnv().REALTIME_PRESENCE_TTL_SECONDS;
  }
  private key(userId: string, socketId: string) {
    return `presence:${userId}:${socketId}`;
  }
  private socketsKey(userId: string) {
    return `presence:sockets:${userId}`;
  }
  public heartbeatIntervalMs() {
    return Math.max(5000, Math.floor((this.ttl * 1000) / 2));
  }
  public async online(userId: string, socketId: string): Promise<void> {
    await this.redis.set(this.key(userId, socketId), '1', 'EX', this.ttl);
    await this.redis.sadd(this.socketsKey(userId), socketId);
    await this.redis.expire(this.socketsKey(userId), this.ttl * 2);
  }
  public async heartbeat(userId: string, socketId: string): Promise<void> {
    await this.redis.expire(this.key(userId, socketId), this.ttl);
    await this.redis.expire(this.socketsKey(userId), this.ttl * 2);
  }
  public async offline(userId: string, socketId: string): Promise<boolean> {
    await this.redis.del(this.key(userId, socketId));
    await this.redis.srem(this.socketsKey(userId), socketId);
    return (await this.redis.scard(this.socketsKey(userId))) > 0;
  }
  public async isOnline(userId: string): Promise<boolean> {
    const sockets = await this.redis.smembers(this.socketsKey(userId));
    if (!sockets.length) return false;
    const active = await this.redis.mget(sockets.map((socketId) => this.key(userId, socketId)));
    return active.some(Boolean);
  }
  public async viewing(conversationId: string, userId: string): Promise<void> {
    await this.redis.set(conversationPresenceKey(conversationId, userId), '1', 'EX', this.ttl * 2);
  }
  public async stopViewing(conversationId: string, userId: string): Promise<void> {
    await this.redis.del(conversationPresenceKey(conversationId, userId));
  }
  public async heartbeatViewing(conversationId: string, userId: string): Promise<void> {
    await this.redis.expire(conversationPresenceKey(conversationId, userId), this.ttl * 2);
  }
}
