import type { EventJobPayload } from '@campusconnection/shared';
import type { Job } from 'bullmq';
import { OutboxEventModel } from '../../../infrastructure/events/outbox-event.model';
import {
  claimEventProcessing,
  completeEventProcessing,
  failEventProcessing,
} from '../../../infrastructure/events/event-processing.repository';
import { IntelligenceService } from './intelligence.service';

function eventUserId(event: {
  actorId?: string;
  payload: Record<string, unknown>;
}): string | undefined {
  const payloadUserId = event.payload.userId;
  return event.actorId ?? (typeof payloadUserId === 'string' ? payloadUserId : undefined);
}

export async function handleRecommendationRefreshJob(
  job: Job<EventJobPayload>,
  service = new IntelligenceService(),
): Promise<void> {
  const event = await OutboxEventModel.findOne({ eventId: job.data.eventId }).exec();
  if (!event) throw new Error(`Outbox event ${job.data.eventId} was not found`);
  const claim = await claimEventProcessing(
    job.data.eventId,
    'recommendation-consumer',
    job.data.eventType,
    job.data.eventVersion,
    job.data.correlationId,
  );
  if (claim.completed) return;
  try {
    const userId = eventUserId(event);
    if (userId) {
      await service.invalidateUser(userId);
      await service.refreshUserRecommendations(userId);
    }
    await completeEventProcessing(job.data.eventId, 'recommendation-consumer');
  } catch (error) {
    await failEventProcessing(
      job.data.eventId,
      'recommendation-consumer',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
