import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvForTests } from '../../src/config/env';

const managedKeys = [
  'NODE_ENV',
  'MONGO_URI',
  'MONGO_DB_NAME',
  'REDIS_URL',
  'CORS_ORIGINS',
  'WEB_ORIGIN',
  'FRONTEND_URL',
  'EMAIL_PROVIDER',
  'EMAIL_API_URL',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'JWT_ACCESS_PRIVATE_KEY',
  'JWT_ACCESS_PUBLIC_KEY',
  'JWT_ACCESS_PRIVATE_KEY_FILE',
  'JWT_ACCESS_PUBLIC_KEY_FILE',
  'COOKIE_SECURE',
  'COOKIE_SAME_SITE',
] as const;

const productionDefaults: Record<(typeof managedKeys)[number], string> = {
  NODE_ENV: 'production',
  MONGO_URI: 'mongodb+srv://cluster.example/campusconnection',
  MONGO_DB_NAME: 'campusconnection_production',
  REDIS_URL: 'rediss://redis.example:6380',
  CORS_ORIGINS: 'https://campusconnection.example',
  WEB_ORIGIN: 'https://campusconnection.example',
  FRONTEND_URL: 'https://campusconnection.example',
  EMAIL_PROVIDER: 'resend',
  EMAIL_API_URL: 'https://api.resend.com/emails',
  EMAIL_API_KEY: 'provider-test-key',
  EMAIL_FROM: 'CampusConnection <noreply@campusconnection.example>',
  JWT_ACCESS_PRIVATE_KEY: 'production-private-key',
  JWT_ACCESS_PUBLIC_KEY: 'production-public-key',
  JWT_ACCESS_PRIVATE_KEY_FILE: '',
  JWT_ACCESS_PUBLIC_KEY_FILE: '',
  COOKIE_SECURE: 'true',
  COOKIE_SAME_SITE: 'none',
};

const originalValues = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of managedKeys) {
    originalValues.set(key, process.env[key]);
    process.env[key] = productionDefaults[key];
  }
  resetEnvForTests();
});

afterEach(() => {
  for (const key of managedKeys) {
    const original = originalValues.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  originalValues.clear();
  resetEnvForTests();
});

function expectProductionFailure(key: string, value: string | undefined, message: string): void {
  for (const managedKey of managedKeys) process.env[managedKey] = productionDefaults[managedKey];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  resetEnvForTests();
  expect(() => getEnv()).toThrow(message);
}

describe('environment configuration safety', () => {
  it('keeps local MongoDB and Redis defaults available in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MONGO_URI;
    delete process.env.REDIS_URL;
    resetEnvForTests();

    const env = getEnv();

    expect(env.MONGO_URI).toContain('mongodb://localhost:27018');
    expect(env.REDIS_URL).toBe('redis://localhost:6380');
  });

  it('requires MongoDB and Redis configuration in production', () => {
    expectProductionFailure('MONGO_URI', undefined, 'MONGO_URI is required in production.');
    expectProductionFailure('REDIS_URL', undefined, 'REDIS_URL is required in production.');
  });

  it('rejects local production infrastructure endpoints', () => {
    expectProductionFailure(
      'MONGO_URI',
      'mongodb://localhost:27018/campusconnection',
      'MONGO_URI must not point to a local development endpoint in production.',
    );
    expectProductionFailure(
      'REDIS_URL',
      'redis://localhost:6380',
      'REDIS_URL must not point to a local development endpoint in production.',
    );
  });

  it('requires production JWT, HTTPS email provider, and secure cookies', () => {
    expectProductionFailure(
      'JWT_ACCESS_PRIVATE_KEY',
      undefined,
      'Production requires JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY as inline PEM values.',
    );
    expectProductionFailure(
      'JWT_ACCESS_PUBLIC_KEY',
      undefined,
      'Production requires JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY as inline PEM values.',
    );
    expectProductionFailure('EMAIL_PROVIDER', 'smtp', 'EMAIL_PROVIDER must be resend in production.');
    expectProductionFailure(
      'EMAIL_API_KEY',
      undefined,
      'EMAIL_API_KEY is required when EMAIL_PROVIDER=resend.',
    );
    expectProductionFailure(
      'EMAIL_FROM',
      undefined,
      'EMAIL_FROM is required when EMAIL_PROVIDER=resend.',
    );
    expectProductionFailure('COOKIE_SECURE', 'false', 'COOKIE_SECURE must be true in production.');
    expectProductionFailure(
      'COOKIE_SAME_SITE',
      'lax',
      'COOKIE_SAME_SITE must be none in production.',
    );
  });

  it('rejects localhost production frontend and CORS origins', () => {
    expectProductionFailure(
      'FRONTEND_URL',
      'http://localhost:5173',
      'FRONTEND_URL must be a non-local HTTPS URL in production.',
    );
    expectProductionFailure(
      'CORS_ORIGINS',
      'http://localhost:5173',
      'CORS_ORIGINS must be a non-local HTTPS URL in production.',
    );
  });
});
