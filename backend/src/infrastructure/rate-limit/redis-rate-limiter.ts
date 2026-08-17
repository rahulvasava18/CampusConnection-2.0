import type Redis from 'ioredis';
import { getEnv } from '../../config/env';
import { getRedisClient } from '../redis/client';
import { logger } from '../../shared/logging/logger';

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export class RedisRateLimiter {
  private readonly fallback = new Map<string, { count: number; expiresAt: number }>();

  public constructor(private readonly redis: Redis = getRedisClient()) {}

  public async consume(
    key: string,
    rule: RateLimitRule,
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const redisKey = `rate:${key}`;
    try {
      const count = await this.redis.incr(redisKey);
      if (count === 1) await this.redis.expire(redisKey, rule.windowSeconds);
      const ttl = await this.redis.ttl(redisKey);
      return { allowed: count <= rule.limit, retryAfterSeconds: Math.max(ttl, 1) };
    } catch (error) {
      logger.warn(
        { err: error, key },
        'Rate limiter Redis unavailable; using bounded process fallback',
      );
      const now = Date.now();
      const existing = this.fallback.get(redisKey);
      const current =
        existing && existing.expiresAt > now
          ? existing
          : { count: 0, expiresAt: now + rule.windowSeconds * 1000 };
      current.count += 1;
      this.fallback.set(redisKey, current);
      return {
        allowed: current.count <= rule.limit,
        retryAfterSeconds: Math.max(Math.ceil((current.expiresAt - now) / 1000), 1),
      };
    }
  }
}

export function authRateRule(kind: 'signup' | 'login' | 'verify' | 'resend'): RateLimitRule {
  void kind;
  const env = getEnv();
  const production = env.NODE_ENV === 'production';
  const limits = {
    signup: production ? env.AUTH_SIGNUP_PROD_LIMIT : env.AUTH_SIGNUP_DEV_LIMIT,
    login: production ? env.AUTH_LOGIN_PROD_LIMIT : env.AUTH_LOGIN_DEV_LIMIT,
    verify: production ? env.AUTH_VERIFY_PROD_LIMIT : env.AUTH_VERIFY_DEV_LIMIT,
    resend: production ? env.AUTH_RESEND_PROD_LIMIT : env.AUTH_RESEND_DEV_LIMIT,
  };
  return {
    limit: limits[kind],
    windowSeconds: 60,
  };
}

export function discoveryRateRule(kind: 'search' | 'autocomplete'): RateLimitRule {
  const env = getEnv();
  const production = env.NODE_ENV === 'production';
  return {
    limit:
      kind === 'search'
        ? production
          ? env.SEARCH_PROD_LIMIT
          : env.SEARCH_DEV_LIMIT
        : production
          ? env.AUTOCOMPLETE_PROD_LIMIT
          : env.AUTOCOMPLETE_DEV_LIMIT,
    windowSeconds: 60,
  };
}

export function realtimeRateRule(kind: 'message' | 'typing'): RateLimitRule {
  const env = getEnv();
  const production = env.NODE_ENV === 'production';
  return {
    limit:
      kind === 'message'
        ? production
          ? env.MESSAGE_PROD_LIMIT
          : env.MESSAGE_DEV_LIMIT
        : production
          ? env.TYPING_PROD_LIMIT
          : env.TYPING_DEV_LIMIT,
    windowSeconds: 60,
  };
}
