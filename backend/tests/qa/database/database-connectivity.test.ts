import mongoose from 'mongoose';
import Redis from 'ioredis';
import { describe, expect, it } from 'vitest';
import { getQaEnvironment } from '../support/test-environment';

describe('dedicated QA dependency connectivity', () => {
  it('connects only to the explicitly configured QA MongoDB and Redis', async () => {
    const env = getQaEnvironment();
    expect(env.mongoDbName).not.toBe('campusconnection');

    const mongo = await mongoose
      .createConnection(env.mongoUri, {
        dbName: env.mongoDbName,
        serverSelectionTimeoutMS: 3000,
      })
      .asPromise();
    const redis = new Redis(env.redisUrl, { lazyConnect: true, connectTimeout: 3000 });
    try {
      expect((await mongo.db!.admin().ping()).ok).toBe(1);
      await redis.connect();
      expect(await redis.ping()).toBe('PONG');
    } finally {
      await redis.quit().catch(() => undefined);
      await mongo.close();
    }
  }, 10000);
});
