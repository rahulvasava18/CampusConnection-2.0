import Redis from 'ioredis';
import { getEnv } from '../../config/env';
import { logger } from '../../shared/logging/logger';

let redisClient: Redis | undefined;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(getEnv().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();
  if (client.status === 'wait') await client.connect();
  await client.ping();
  logger.info('Redis connected');
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.status !== 'end') {
    await redisClient.quit();
    logger.info('Redis disconnected');
  }
}

export function isRedisReady(): boolean {
  return redisClient?.status === 'ready';
}
