import { SessionModel } from '../../modules/identity/infrastructure/session.model';
import { EventProcessingModel, DeadLetterModel } from '../events/event-processing.model';
import { MongooseOutboxEventRepository } from '../events/outbox.repository';
import { getEnv } from '../../config/env';
import { logger } from '../../shared/logging/logger';

export type CleanupJobName =
  'cleanup-expired-sessions' | 'archive-outbox' | 'cleanup-processing-records';

export async function handleCleanupJob(name: CleanupJobName): Promise<Record<string, number>> {
  if (name === 'cleanup-expired-sessions') {
    const result = await SessionModel.deleteMany({ expiresAt: { $lt: new Date() } }).exec();
    return { deleted: result.deletedCount };
  }
  if (name === 'archive-outbox') {
    const before = new Date(Date.now() - getEnv().OUTBOX_ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const archived = await new MongooseOutboxEventRepository().archivePublished(before);
    return { archived };
  }
  const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await EventProcessingModel.deleteMany({
    status: 'COMPLETED',
    completedAt: { $lt: before },
  }).exec();
  await DeadLetterModel.deleteMany({ status: 'RESOLVED', updatedAt: { $lt: before } }).exec();
  logger.info(
    { jobName: name, deleted: result.deletedCount },
    'Processing-record cleanup completed',
  );
  return { deleted: result.deletedCount };
}
