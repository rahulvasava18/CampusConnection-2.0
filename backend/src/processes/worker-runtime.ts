import { UnrecoverableError, type Job, type Worker } from 'bullmq';
import type { EventJobPayload } from '@campusconnection/shared';
import {
  allQueueNames,
  closeQueues,
  createQueue,
  createWorker,
  QUEUES,
  OUTBOX_PUBLISH_INTERVAL_MS,
} from '../infrastructure/queue/bullmq';
import { OutboxPublisher } from '../infrastructure/events/outbox-publisher';
import { routeDomainEvent } from '../infrastructure/events/event-router';
import {
  handleAnalyticsJob,
  handleDerivedJob,
  handleNotificationJob,
  handleSearchIndexJob,
} from '../infrastructure/queue/handlers';
import { handleCleanupJob, type CleanupJobName } from '../infrastructure/queue/cleanup.handlers';
import { ensureScheduledJobs } from '../infrastructure/queue/scheduler';
import { isPermanentJobError } from '../infrastructure/queue/job-errors';
import { DeadLetterModel } from '../infrastructure/events/event-processing.model';
import { logger } from '../shared/logging/logger';
import { getEnv } from '../config/env';
import { handleRecommendationRefreshJob } from '../modules/intelligence/application/recommendation.worker';
import { handleVerificationEmailJob } from '../infrastructure/queue/email.handlers';

type AnyJob = Job<unknown>;

function eventData(job: AnyJob): Partial<EventJobPayload> {
  return typeof job.data === 'object' && job.data !== null
    ? (job.data as Partial<EventJobPayload>)
    : {};
}

async function recordDeadLetter(job: AnyJob, error: Error): Promise<void> {
  const data = eventData(job);
  await DeadLetterModel.updateOne(
    { jobId: String(job.id), queue: job.queueName },
    {
      $set: {
        eventId: data.eventId,
        eventType: data.eventType,
        correlationId: data.correlationId,
        attempts: job.attemptsMade,
        status: 'OPEN',
        payload: (job.data ?? {}) as Record<string, unknown>,
        lastError: error.message.slice(0, 2000),
        failedAt: new Date(),
      },
    },
    { upsert: true },
  ).exec();
}

function safeProcessor<T>(
  processor: (job: Job<T>) => Promise<unknown>,
): (job: Job<T>) => Promise<unknown> {
  return async (job) => {
    try {
      return await processor(job);
    } catch (error) {
      if (isPermanentJobError(error))
        throw new UnrecoverableError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };
}

export interface WorkerRuntime {
  workers: Worker[];
  publisher: OutboxPublisher;
  publisherTimer: NodeJS.Timeout;
}

export async function createWorkerRuntime(): Promise<WorkerRuntime> {
  await Promise.all(allQueueNames().map((name) => createQueue(name).waitUntilReady()));
  await ensureScheduledJobs();
  const concurrency = getEnv().WORKER_CONCURRENCY;
  const workers: Worker[] = [
    createWorker(
      QUEUES.events,
      safeProcessor(async (job: Job<EventJobPayload>) => routeDomainEvent(job.data)),
      concurrency,
    ),
    createWorker(QUEUES.notifications, safeProcessor(handleNotificationJob), concurrency),
    createWorker(QUEUES.analytics, safeProcessor(handleAnalyticsJob), concurrency),
    createWorker(QUEUES.searchIndex, safeProcessor(handleSearchIndexJob), concurrency),
    createWorker(
      QUEUES.feed,
      safeProcessor((job) => handleDerivedJob(job, 'FEED')),
      concurrency,
    ),
    createWorker(QUEUES.recommendation, safeProcessor(handleRecommendationRefreshJob), concurrency),
    createWorker(
      QUEUES.cleanup,
      safeProcessor(async (job: Job<{ name: CleanupJobName }>) => handleCleanupJob(job.data.name)),
      1,
    ),
    createWorker(
      QUEUES.scheduler,
      safeProcessor(async (job) => {
        if (job.name !== 'maintenance-tick') return;
        const cleanupQueue = createQueue(QUEUES.cleanup);
        const stamp = Math.floor(Date.now() / (60 * 60 * 1000));
        for (const name of [
          'cleanup-expired-sessions',
          'archive-outbox',
          'cleanup-processing-records',
        ] as CleanupJobName[]) {
          await cleanupQueue.add(name, { name }, { jobId: `${name}-${stamp}` });
        }
      }),
      1,
    ),
    createWorker(
      QUEUES.email,
      safeProcessor(handleVerificationEmailJob),
      1,
    ),
    createWorker(
      QUEUES.media,
      safeProcessor(async (job) => {
        logger.info(
          { jobId: job.id, queue: QUEUES.media },
          'Media processing queue is reserved for the Media phase',
        );
        return { status: 'deferred' };
      }),
      1,
    ),
  ];
  for (const worker of workers) {
    worker.on('completed', (job, result) =>
      logger.info({ jobId: job.id, queue: job.queueName, result }, 'Background job completed'),
    );
    worker.on('failed', (job, error) => {
      if (job) {
        logger.error(
          { jobId: job.id, queue: job.queueName, attempt: job.attemptsMade, err: error },
          'Background job failed',
        );
        if (job.attemptsMade >= Number(job.opts.attempts ?? 1)) void recordDeadLetter(job, error);
      }
    });
    worker.on('error', (error) =>
      logger.error({ err: error, queue: worker.name }, 'Background worker error'),
    );
  }
  const publisher = new OutboxPublisher();
  const publisherTimer = setInterval(
    () =>
      void publisher
        .publishOnce()
        .catch((error) => logger.error({ err: error }, 'Outbox publisher tick failed')),
    OUTBOX_PUBLISH_INTERVAL_MS,
  );
  await publisher.publishOnce();
  logger.info({ queues: allQueueNames(), concurrency }, 'Phase 7 worker runtime listening');
  return { workers, publisher, publisherTimer };
}

export async function stopWorkerRuntime(runtime: WorkerRuntime): Promise<void> {
  clearInterval(runtime.publisherTimer);
  await Promise.all(runtime.workers.map((worker) => worker.close()));
  await runtime.publisher.close();
  await closeQueues();
}
