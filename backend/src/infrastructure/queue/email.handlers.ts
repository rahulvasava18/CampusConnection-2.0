import type { EventJobPayload } from '@campusconnection/shared';
import type { Job } from 'bullmq';
import { OutboxEventModel } from '../events/outbox-event.model';
import {
  claimEventProcessing,
  completeEventProcessing,
  failEventProcessing,
} from '../events/event-processing.repository';
import {
  createEmailService,
  type VerificationEmailInput,
} from '../../modules/identity/infrastructure/email.service';
import { logger } from '../../shared/logging/logger';
import { PermanentJobError } from './job-errors';

type EmailJob = Job<EventJobPayload>;

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function recipientDomain(value: string): string {
  return value.split('@')[1] ?? 'unknown';
}

export async function handleVerificationEmailJob(job: EmailJob): Promise<void> {
  const event = await OutboxEventModel.findOne({ eventId: job.data.eventId }).exec();
  if (!event) throw new PermanentJobError(`Outbox event ${job.data.eventId} was not found`);
  if (event.eventType !== 'VERIFICATION_EMAIL_REQUESTED')
    throw new PermanentJobError(`Unsupported email event type: ${event.eventType}`);
  const eventVersion = event.eventVersion ?? event.schemaVersion;
  if (eventVersion !== 1 || job.data.eventVersion !== eventVersion)
    throw new PermanentJobError(`Unsupported email event version: ${eventVersion}`);

  const claim = await claimEventProcessing(
    job.data.eventId,
    'email-delivery',
    job.data.eventType,
    eventVersion,
    job.data.correlationId,
  );
  if (claim.completed) return;

  try {
    const payload = event.payload as Record<string, unknown>;
    const input: VerificationEmailInput = {
      to: payload.to as string,
      displayName: payload.displayName as string,
      token: payload.token as string,
      idempotencyKey: job.data.eventId,
    };
    if (!isString(input.to) || !isString(input.displayName) || !isString(input.token))
      throw new PermanentJobError('Verification email payload is invalid.');

    await createEmailService().sendVerificationEmail(input);
    await completeEventProcessing(job.data.eventId, 'email-delivery');
    logger.info(
      {
        jobId: job.id,
        eventId: job.data.eventId,
        eventType: job.data.eventType,
        queue: job.queueName,
        recipientDomain: recipientDomain(input.to),
        result: 'completed',
      },
      'Verification email delivered',
    );
  } catch (error) {
    await failEventProcessing(
      job.data.eventId,
      'email-delivery',
      error instanceof Error ? error.message : 'Email delivery failed.',
    );
    throw error;
  }
}
