import { Writable } from 'node:stream';
import pino from 'pino';
import { getEnv } from '../../config/env';

const env = getEnv();
const arrow = '\u2192';

class DevelopmentLogStream extends Writable {
  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error) => void) {
    try {
      const entry = JSON.parse(chunk.toString()) as Record<string, unknown>;
      process.stdout.write(`${formatDevelopmentLog(entry)}\n`);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Unable to format development log.'));
    }
  }
}

function formatDevelopmentLog(entry: Record<string, unknown>): string {
  const level = levelName(entry.level);
  const req = asRecord(entry.req);
  const res = asRecord(entry.res);
  const error = asRecord(entry.err);
  const errorMessage = stringValue(error?.message);

  if (req && res) {
    const method = stringValue(req.method) ?? 'REQUEST';
    const url = stringValue(req.url) ?? '/';
    const status = numberValue(res.statusCode) ?? 0;
    const duration = numberValue(entry.responseTime);
    const timing = duration === undefined ? '' : ` (${Math.round(duration)}ms)`;
    if (level === 'ERROR') {
      const detail = errorMessage ? `\n        ${errorMessage}` : '';
      return `[ERROR] ${method} ${url} ${arrow} ${status}${timing}${detail}`;
    }
    return `[HTTP] ${method} ${url} ${arrow} ${status}${timing}`;
  }

  const message = stringValue(entry.msg) ?? 'log entry';
  if (message === 'MongoDB connected') return '[INFO] MongoDB connected';
  if (message === 'Redis connected') return '[INFO] Redis connected';
  if (message === 'API server running') {
    const port = numberValue(entry.port);
    return `[INFO] API server running${port === undefined ? '' : ` on http://localhost:${port}`}`;
  }
  if (level === 'ERROR' && errorMessage) return `[ERROR] ${message}\n        ${errorMessage}`;

  const details = [
    stringValue(entry.database),
    numberValue(entry.port) === undefined ? undefined : `http://localhost:${entry.port}`,
    stringValue(entry.signal) ? `signal=${entry.signal}` : undefined,
  ].filter(Boolean);
  return `[${level}] ${message}${details.length ? ` - ${details.join(' ')}` : ''}`;
}

function levelName(level: unknown): string {
  if (typeof level !== 'number') return 'INFO';
  if (level >= 60) return 'FATAL';
  if (level >= 50) return 'ERROR';
  if (level >= 40) return 'WARN';
  if (level >= 30) return 'INFO';
  if (level >= 20) return 'DEBUG';
  return 'TRACE';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    base: {
      service: 'campusconnection',
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  },
  env.NODE_ENV === 'development' ? new DevelopmentLogStream() : undefined,
);
