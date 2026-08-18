import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

loadDotenv({
  path: [resolve(process.cwd(), 'backend/.env'), resolve(process.cwd(), '.env')],
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  REALTIME_PORT: z.coerce.number().int().positive().default(4001),
  MONGO_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27018/campusconnection?replicaSet=rs0&directConnection=true'),
  MONGO_DB_NAME: z.string().min(1).default('campusconnection'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6380'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  JWT_ACCESS_PRIVATE_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  JWT_ACCESS_PUBLIC_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  JWT_ACCESS_PRIVATE_KEY_FILE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  JWT_ACCESS_PUBLIC_KEY_FILE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  JWT_KEY_ID: z.string().min(1).default('cc-dev-key-1'),
  JWT_ISSUER: z.string().min(1).default('campusconnection-api'),
  JWT_AUDIENCE: z.string().min(1).default('campusconnection-web'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_COOKIE_NAME: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  CSRF_COOKIE_NAME: z.string().min(1).default('cc_csrf'),
  CSRF_HEADER_NAME: z.string().min(1).default('X-CSRF-Token'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  GOOGLE_CLIENT_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:4000/api/auth/google/callback'),
  EMAIL_PROVIDER: z.enum(['smtp', 'resend']).default('smtp'),
  EMAIL_API_URL: z.string().url().default('https://api.resend.com/emails'),
  EMAIL_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  EMAIL_FROM: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  EMAIL_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  SMTP_HOST: z.string().min(1).default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  SMTP_PASSWORD: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  SMTP_FROM: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  CLOUDINARY_CLOUD_NAME: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  CLOUDINARY_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  CLOUDINARY_API_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),
  AUTH_SIGNUP_DEV_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_SIGNUP_PROD_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_LOGIN_DEV_LIMIT: z.coerce.number().int().positive().default(20),
  AUTH_LOGIN_PROD_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_VERIFY_DEV_LIMIT: z.coerce.number().int().positive().default(20),
  AUTH_VERIFY_PROD_LIMIT: z.coerce.number().int().positive().default(10),
  AUTH_RESEND_DEV_LIMIT: z.coerce.number().int().positive().default(5),
  AUTH_RESEND_PROD_LIMIT: z.coerce.number().int().positive().default(3),
  SEARCH_PROVIDER: z.enum(['mongodb', 'atlas']).default('mongodb'),
  SEARCH_ATLAS_INDEX: z.string().min(1).default('campusconnection_search_v1'),
  SEARCH_FALLBACK_MAX_CANDIDATES: z.coerce.number().int().min(50).max(1000).default(250),
  SEARCH_DEV_LIMIT: z.coerce.number().int().positive().default(300),
  SEARCH_PROD_LIMIT: z.coerce.number().int().positive().default(60),
  AUTOCOMPLETE_DEV_LIMIT: z.coerce.number().int().positive().default(600),
  AUTOCOMPLETE_PROD_LIMIT: z.coerce.number().int().positive().default(120),
  MESSAGE_DEV_LIMIT: z.coerce.number().int().positive().default(300),
  MESSAGE_PROD_LIMIT: z.coerce.number().int().positive().default(60),
  TYPING_DEV_LIMIT: z.coerce.number().int().positive().default(120),
  TYPING_PROD_LIMIT: z.coerce.number().int().positive().default(30),
  REALTIME_PRESENCE_TTL_SECONDS: z.coerce.number().int().positive().default(45),
});

export type AppEnv = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  refreshCookieName: string;
};

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.parse(process.env);
  if (parsed.NODE_ENV === 'production') {
    validateProductionEnvironment(parsed);
  }
  cachedEnv = {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    refreshCookieName:
      parsed.NODE_ENV === 'production'
        ? '__Host-cc_refresh'
        : (parsed.REFRESH_COOKIE_NAME ?? 'cc_refresh'),
  };
  return cachedEnv;
}

function validateProductionEnvironment(parsed: z.infer<typeof envSchema>): void {
  for (const name of [
    'MONGO_URI',
    'MONGO_DB_NAME',
    'REDIS_URL',
    'CORS_ORIGINS',
    'WEB_ORIGIN',
    'FRONTEND_URL',
    'EMAIL_PROVIDER',
    'EMAIL_API_URL',
  ] as const) {
    if (!hasConfiguredValue(name)) throw new Error(`${name} is required in production.`);
  }

  if (isLocalEndpoint(parsed.MONGO_URI)) {
    throw new Error('MONGO_URI must not point to a local development endpoint in production.');
  }
  if (isLocalEndpoint(parsed.REDIS_URL)) {
    throw new Error('REDIS_URL must not point to a local development endpoint in production.');
  }

  assertProductionHttpsUrl('WEB_ORIGIN', parsed.WEB_ORIGIN);
  assertProductionHttpsUrl('FRONTEND_URL', parsed.FRONTEND_URL);
  assertProductionHttpsUrl('EMAIL_API_URL', parsed.EMAIL_API_URL);
  const origins = parsed.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (!origins.length || origins.includes('*')) {
    throw new Error('CORS_ORIGINS must contain explicit HTTPS origins in production.');
  }
  for (const origin of origins) assertProductionHttpsUrl('CORS_ORIGINS', origin);

  const hasInlineKeyPair = Boolean(parsed.JWT_ACCESS_PRIVATE_KEY && parsed.JWT_ACCESS_PUBLIC_KEY);
  const hasFileKeyConfiguration = Boolean(
    parsed.JWT_ACCESS_PRIVATE_KEY_FILE || parsed.JWT_ACCESS_PUBLIC_KEY_FILE,
  );
  if (!hasInlineKeyPair) {
    throw new Error(
      'Production requires JWT_ACCESS_PRIVATE_KEY and JWT_ACCESS_PUBLIC_KEY as inline PEM values.',
    );
  }
  if (hasFileKeyConfiguration) {
    throw new Error(
      'JWT_ACCESS_PRIVATE_KEY_FILE and JWT_ACCESS_PUBLIC_KEY_FILE are only supported outside production.',
    );
  }
  if (parsed.EMAIL_PROVIDER !== 'resend') {
    throw new Error('EMAIL_PROVIDER must be resend in production.');
  }
  if (!parsed.EMAIL_API_KEY) {
    throw new Error('EMAIL_API_KEY is required when EMAIL_PROVIDER=resend.');
  }
  if (!parsed.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=resend.');
  }
  if (!parsed.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE must be true in production.');
  }
  if (parsed.COOKIE_SAME_SITE !== 'none') {
    throw new Error('COOKIE_SAME_SITE must be none in production.');
  }
  assertProductionHttpsUrl('GOOGLE_OAUTH_REDIRECT_URI', parsed.GOOGLE_OAUTH_REDIRECT_URI);
  if (!parsed.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required in production.');
  if (!parsed.GOOGLE_CLIENT_SECRET)
    throw new Error('GOOGLE_CLIENT_SECRET is required in production.');
}

function hasConfiguredValue(name: string): boolean {
  return typeof process.env[name] === 'string' && process.env[name]!.trim().length > 0;
}

function isLocalEndpoint(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (/^(mongodb(?:\+srv)?|rediss?):\/\/(mongodb|redis)(?::|\/|$)/.test(normalized)) return true;
  return /(^|[/:@])(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(normalized);
}

function assertProductionHttpsUrl(name: string, value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL in production.`);
  }
  if (parsed.protocol !== 'https:' || isLocalEndpoint(value)) {
    throw new Error(`${name} must be a non-local HTTPS URL in production.`);
  }
}

export function resetEnvForTests(): void {
  cachedEnv = undefined;
}
