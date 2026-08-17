import type { EventJobPayload, EventType } from '@campusconnection/shared';
import { OutboxEventModel } from './outbox-event.model';
import {
  claimEventProcessing,
  completeEventProcessing,
  failEventProcessing,
} from './event-processing.repository';
import { createQueue, QUEUES } from '../queue/bullmq';
import { logger } from '../../shared/logging/logger';
import { PermanentJobError } from '../queue/job-errors';

const notificationEvents = new Set<EventType>([
  'CONNECTION_REQUESTED',
  'CONNECTION_ACCEPTED',
  'REACTION_ADDED',
  'COMMENT_CREATED',
  'REPLY_CREATED',
  'TEAM_INVITATION_SENT',
  'TEAM_JOIN_REQUESTED',
  'TEAM_JOIN_REQUEST_APPROVED',
  'TEAM_JOIN_REQUEST_REJECTED',
  'TEAM_ROLE_CHANGED',
  'TEAM_OWNERSHIP_TRANSFERRED',
  'TEAM_COMPLETED',
  'TEAM_MEMBER_JOINED',
  'PROJECT_COMPLETED',
  'PROJECT_INVITATION_SENT',
  'PROJECT_INVITATION_ACCEPTED',
  'PROJECT_JOIN_REQUESTED',
  'PROJECT_JOIN_REQUEST_APPROVED',
  'PROJECT_JOIN_REQUEST_REJECTED',
  'PROJECT_OWNERSHIP_TRANSFERRED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'EVENT_ARCHIVED',
  'EVENT_REGISTRATION_CONFIRMED',
  'EVENT_REGISTRATION_CANCELLED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'TASK_ASSIGNED',
  'TASK_COMPLETED',
  'MILESTONE_COMPLETED',
  'MESSAGE_SENT',
  'COMMUNITY_JOINED',
  'COMMUNITY_JOIN_REQUESTED',
  'COMMUNITY_JOIN_REQUEST_APPROVED',
  'COMMUNITY_JOIN_REQUEST_REJECTED',
  'COMMUNITY_INVITATION_SENT',
  'COMMUNITY_INVITATION_ACCEPTED',
  'COMMUNITY_MEMBER_REMOVED',
  'COMMUNITY_MEMBER_BANNED',
  'COMMUNITY_MEMBER_UNBANNED',
  'COMMUNITY_REPORT_CREATED',
]);
const searchEvents = new Set<EventType>([
  'PROFILE_UPDATED',
  'SKILLS_UPDATED',
  'INTERESTS_UPDATED',
  'GOALS_UPDATED',
  'POST_CREATED',
  'POST_UPDATED',
  'POST_DELETED',
  'COMMUNITY_CREATED',
  'COMMUNITY_UPDATED',
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'TEAM_ARCHIVED',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_ACTIVATED',
  'PROJECT_ARCHIVED',
  'PROJECT_COMPLETED',
  'EVENT_CREATED',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'EVENT_ARCHIVED',
  'SEARCH_INDEX_UPDATE_REQUESTED',
]);
const recommendationEvents = new Set<EventType>([
  'USER_VERIFIED',
  'PROFILE_UPDATED',
  'SKILLS_UPDATED',
  'INTERESTS_UPDATED',
  'GOALS_UPDATED',
  'POST_CREATED',
  'POST_UPDATED',
  'CONNECTION_ACCEPTED',
  'CONNECTION_REJECTED',
  'CONNECTION_REMOVED',
  'COMMUNITY_CREATED',
  'COMMUNITY_UPDATED',
  'TEAM_CREATED',
  'TEAM_UPDATED',
  'TEAM_MEMBER_JOINED',
  'TEAM_MEMBER_LEFT',
  'TEAM_REQUIREMENT_CREATED',
  'TEAM_REQUIREMENT_UPDATED',
  'TEAM_REQUIREMENT_DELETED',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_ACTIVATED',
  'PROJECT_ARCHIVED',
  'PROJECT_COMPLETED',
  'PROJECT_MEMBER_ADDED',
  'PROJECT_MEMBER_REMOVED',
  'REACTION_ADDED',
  'COMMENT_CREATED',
  'COMMUNITY_JOINED',
  'COMMUNITY_LEFT',
  'RECOMMENDATION_FEEDBACK',
]);
const feedEvents = new Set<EventType>([
  'POST_CREATED',
  'CONNECTION_ACCEPTED',
  'COMMUNITY_JOINED',
  'PROJECT_SHOWCASED',
]);

export async function routeDomainEvent(job: EventJobPayload): Promise<void> {
  const envelope = await OutboxEventModel.findOne({ eventId: job.eventId }).lean().exec();
  if (!envelope) throw new PermanentJobError(`Outbox event ${job.eventId} was not found`);
  const eventVersion = envelope.eventVersion ?? envelope.schemaVersion;
  if (eventVersion !== 1 || job.eventVersion !== eventVersion)
    throw new PermanentJobError(`Unsupported event version for ${job.eventType}: ${eventVersion}`);
  const claim = await claimEventProcessing(
    job.eventId,
    'event-router',
    job.eventType,
    eventVersion,
    job.correlationId,
  );
  if (claim.completed) return;
  try {
    const eventJob = { ...job, eventVersion, schemaVersion: envelope.schemaVersion };
    const queues = [
      ...(notificationEvents.has(job.eventType)
        ? [{ queue: QUEUES.notifications, name: 'notification-event' }]
        : []),
      ...(searchEvents.has(job.eventType)
        ? [{ queue: QUEUES.searchIndex, name: 'search-index-event' }]
        : []),
      ...(recommendationEvents.has(job.eventType)
        ? [{ queue: QUEUES.recommendation, name: 'recommendation-event' }]
        : []),
      ...(feedEvents.has(job.eventType) ? [{ queue: QUEUES.feed, name: 'feed-event' }] : []),
      { queue: QUEUES.analytics, name: 'analytics-event' },
    ];
    for (const target of queues) {
      await createQueue(target.queue).add(target.name, eventJob, {
        jobId: `${target.queue}-${job.eventId}`,
      });
    }
    await completeEventProcessing(job.eventId, 'event-router');
    logger.info(
      {
        eventId: job.eventId,
        eventType: job.eventType,
        correlationId: job.correlationId,
        destinations: queues.map((item) => item.queue),
      },
      'Domain event routed',
    );
  } catch (error) {
    await failEventProcessing(
      job.eventId,
      'event-router',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
