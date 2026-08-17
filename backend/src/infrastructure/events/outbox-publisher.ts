import type { EventJobPayload } from '@campusconnection/shared';
import { getEnv } from '../../config/env';
import { logger } from '../../shared/logging/logger';
import { createQueue, QUEUES } from '../queue/bullmq';
import { DeadLetterModel } from './event-processing.model';
import { MongooseOutboxEventRepository } from './outbox.repository';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
}

export class OutboxPublisher {
  private readonly repository: MongooseOutboxEventRepository;
  private readonly queue = createQueue(QUEUES.events);

  public constructor(repository = new MongooseOutboxEventRepository()) {
    this.repository = repository;
  }

  public async publishOnce(): Promise<number> {
    const env = getEnv();
    const events = await this.repository.claimBatch(env.OUTBOX_BATCH_SIZE, env.OUTBOX_LEASE_MS);
    for (const event of events) {
      const eventVersion = event.eventVersion ?? event.schemaVersion;
      const payload: EventJobPayload = {
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion,
        schemaVersion: event.schemaVersion,
        correlationId: event.correlationId,
        ...(event.causationId ? { causationId: event.causationId } : {}),
      };
      try {
        await this.queue.add('domain-event', payload, { jobId: `event-${event.eventId}` });
        await this.repository.markPublished(event.eventId, event.claimId ?? '');
        logger.info(
          {
            eventId: event.eventId,
            eventType: event.eventType,
            correlationId: event.correlationId,
          },
          'Outbox event enqueued',
        );
      } catch (error) {
        const message = errorMessage(error);
        if (event.attempts >= env.QUEUE_JOB_ATTEMPTS) {
          await this.repository.fail(event.eventId, event.claimId ?? '', message);
          await DeadLetterModel.updateOne(
            { jobId: `outbox:${event.eventId}` },
            {
              $set: {
                queue: QUEUES.events,
                eventId: event.eventId,
                eventType: event.eventType,
                correlationId: event.correlationId,
                attempts: event.attempts,
                status: 'OPEN',
                payload: payload as unknown as Record<string, unknown>,
                lastError: message,
                failedAt: new Date(),
              },
            },
            { upsert: true },
          ).exec();
        } else {
          await this.repository.release(
            event.eventId,
            event.claimId ?? '',
            message,
            new Date(Date.now() + env.OUTBOX_RETRY_DELAY_MS),
          );
        }
        logger.error(
          {
            err: error,
            eventId: event.eventId,
            eventType: event.eventType,
            correlationId: event.correlationId,
          },
          'Outbox event enqueue failed',
        );
      }
    }
    return events.length;
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}
