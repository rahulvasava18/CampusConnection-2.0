import type { DomainEvent } from './domain-event';
import { handleNotificationEvent } from '../../modules/notifications/application/notification.dispatcher';
import { IntelligenceService } from '../../modules/intelligence/application/intelligence.service';
import { AnalyticsEventModel } from '../analytics/analytics-event.model';
import { logger } from '../../shared/logging/logger';

const notificationEvents = new Set([
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

const recommendationEvents = new Set([
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
]);

function eventUserId(event: DomainEvent): string | undefined {
  const payloadUserId = event.payload.userId;
  return typeof payloadUserId === 'string' ? payloadUserId : event.actorId;
}

function safePayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        (key.endsWith('Id') || key === 'reason' || key === 'status' || key === 'postType') &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'),
    ),
  );
}

async function recordAnalytics(event: DomainEvent): Promise<void> {
  try {
    await AnalyticsEventModel.updateOne(
      { sourceEventId: event.eventId },
      {
        $setOnInsert: {
          sourceEventId: event.eventId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          correlationId: event.correlationId,
          occurredAt: new Date(event.occurredAt),
          payloadSummary: safePayloadSummary(event.payload),
        },
      },
      { upsert: true },
    ).exec();
  } catch (error) {
    logger.warn(
      { eventType: event.eventType, correlationId: event.correlationId, err: error },
      'Analytics recording skipped',
    );
  }
}

export async function dispatchCoreEvents(events: DomainEvent[]): Promise<void> {
  const intelligence = new IntelligenceService();
  await Promise.all(
    events.map(async (event) => {
      const work: Promise<void>[] = [];
      if (notificationEvents.has(event.eventType)) {
        work.push(handleNotificationEvent(event));
      }
      if (recommendationEvents.has(event.eventType)) {
        const userId = eventUserId(event);
        if (userId)
          work.push(
            intelligence.invalidateUser(userId).then(() =>
              intelligence.refreshUserRecommendations(userId),
            ),
          );
      }
      work.push(recordAnalytics(event));
      await Promise.all(work);
    }),
  );
}
