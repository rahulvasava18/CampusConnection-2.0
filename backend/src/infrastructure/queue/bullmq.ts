import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import { EVENT_QUEUE_NAMES, type EventQueueName } from '@campusconnection/shared';
import { getEnv } from '../../config/env';

export const QUEUES = EVENT_QUEUE_NAMES;
export const OUTBOX_PUBLISH_INTERVAL_MS = 1000;
const queueCache = new Map<string, Queue>();

export function getRedisConnectionOptions(): {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
} {
  const parsed = new URL(getEnv().REDIS_URL);
  const database = parsed.pathname.replace(/^\//, '');
  const db = database ? Number(database) : undefined;
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    maxRetriesPerRequest: null,
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(db !== undefined && Number.isInteger(db) && db >= 0 ? { db } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export function defaultJobOptions(): JobsOptions {
  return {
    attempts: getEnv().QUEUE_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: getEnv().QUEUE_BACKOFF_DELAY_MS },
    removeOnComplete: { age: getEnv().QUEUE_COMPLETED_RETENTION_SECONDS, count: 1000 },
    removeOnFail: false,
  };
}

export function createQueue(queueName: EventQueueName | string): Queue {
  const existing = queueCache.get(queueName);
  if (existing) return existing;
  const queue = new Queue(queueName, {
    connection: getRedisConnectionOptions(),
    prefix: getEnv().QUEUE_PREFIX,
    defaultJobOptions: defaultJobOptions(),
  });
  queueCache.set(queueName, queue);
  return queue;
}

export function createWorker<T = unknown>(
  queueName: EventQueueName | string,
  processor: Processor<T>,
  concurrency = 2,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: getRedisConnectionOptions(),
    prefix: getEnv().QUEUE_PREFIX,
    concurrency,
    autorun: true,
  });
}

export function allQueueNames(): EventQueueName[] {
  return Object.values(QUEUES);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queueCache.values()].map((queue) => queue.close()));
  queueCache.clear();
}
