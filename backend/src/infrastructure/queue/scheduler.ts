import { createQueue, QUEUES } from './bullmq';
import { logger } from '../../shared/logging/logger';

export async function ensureScheduledJobs(): Promise<void> {
  const queue = createQueue(QUEUES.scheduler);
  await queue.upsertJobScheduler(
    'maintenance-hourly',
    { every: 60 * 60 * 1000 },
    {
      name: 'maintenance-tick',
      data: { scheduledBy: 'worker' },
      opts: { removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: false },
    },
  );
  logger.info({ queue: QUEUES.scheduler }, 'Scheduled jobs registered');
}
