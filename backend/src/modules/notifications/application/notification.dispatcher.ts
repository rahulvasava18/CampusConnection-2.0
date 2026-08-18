import type { DomainEvent } from '../../../infrastructure/events/domain-event';
import { NotificationModel } from '../infrastructure/notification.model';
import {
  ConversationMemberModel,
  MessageModel,
} from '../../communication/infrastructure/communication.models';
import { getRedisClient } from '../../../infrastructure/redis/client';
import { conversationPresenceKey } from '../../communication/realtime/presence';
import { CommentModel, PostModel } from '../../social/infrastructure/social.models';
import {
  CommunityModel,
  DiscussionModel,
  EventModel,
  EventRegistrationModel,
  ProjectModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { UserModel } from '../../identity/infrastructure/user.model';

type EventRecord = DomainEvent;

function payloadOf(event: EventRecord): Record<string, unknown> {
  return (event.payload ?? {}) as Record<string, unknown>;
}

function id(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

type NotificationContext = {
  actorDisplayName?: string;
  actorUsername?: string;
  entityName?: string;
};

async function notificationEntityName(
  payload: Record<string, unknown>,
): Promise<string | undefined> {
  const teamId = id(payload.teamId);
  if (teamId)
    return (await TeamModel.findById(teamId).select('name').lean().exec())?.name?.trim();
  const projectId = id(payload.projectId);
  if (projectId)
    return (await ProjectModel.findById(projectId).select('name').lean().exec())?.name?.trim();
  const communityId = id(payload.communityId);
  if (communityId)
    return (await CommunityModel.findById(communityId).select('name').lean().exec())?.name?.trim();
  const eventId = id(payload.eventId);
  if (eventId)
    return (await EventModel.findById(eventId).select('title').lean().exec())?.title?.trim();
  return undefined;
}

async function notificationContext(
  event: EventRecord,
  payload: Record<string, unknown>,
): Promise<NotificationContext> {
  const actorPromise = event.actorId
    ? UserModel.findById(event.actorId).select('displayName username').lean().exec()
    : Promise.resolve(null);
  const [actor, entityName] = await Promise.all([
    actorPromise,
    notificationEntityName(payload),
  ]);
  const actorDisplayName = actor?.displayName?.trim();
  const actorUsername = actor?.username?.trim();
  return {
    ...(actorDisplayName ? { actorDisplayName } : {}),
    ...(actorUsername ? { actorUsername } : {}),
    ...(entityName ? { entityName } : {}),
  };
}

function notificationMetadata(
  payload: Record<string, unknown>,
  context: NotificationContext,
): Record<string, string | number | boolean> | undefined {
  const metadata = Object.fromEntries(
    Object.entries(payload).filter(
      ([key, value]) =>
        (key.endsWith('Id') || ['status', 'role', 'targetType', 'reactionType'].includes(key)) &&
        ['string', 'number', 'boolean'].includes(typeof value),
    ),
  ) as Record<string, string | number | boolean>;
  Object.assign(metadata, context);
  return Object.keys(metadata).length ? metadata : undefined;
}

function notificationText(eventType: string): { type: string; title: string } {
  const values: Record<string, { type: string; title: string }> = {
    CONNECTION_REQUESTED: {
      type: 'CONNECTION_REQUESTED',
      title: 'You received a connection request',
    },
    CONNECTION_ACCEPTED: {
      type: 'CONNECTION_ACCEPTED',
      title: 'Your connection request was accepted',
    },
    REACTION_ADDED: { type: 'REACTION_ADDED', title: 'Someone liked your post or comment' },
    COMMENT_CREATED: { type: 'COMMENT_CREATED', title: 'Someone commented on your post' },
    REPLY_CREATED: { type: 'REPLY_CREATED', title: 'Someone replied to a community discussion' },
    TEAM_INVITATION_SENT: { type: 'TEAM_INVITATION_SENT', title: 'You received a team invitation' },
    TEAM_JOIN_REQUESTED: { type: 'TEAM_JOIN_REQUESTED', title: 'A team join request needs review' },
    TEAM_JOIN_REQUEST_APPROVED: {
      type: 'TEAM_JOIN_REQUEST_APPROVED',
      title: 'Your team join request was approved',
    },
    TEAM_JOIN_REQUEST_REJECTED: {
      type: 'TEAM_JOIN_REQUEST_REJECTED',
      title: 'Your team join request was declined',
    },
    TEAM_ROLE_CHANGED: { type: 'TEAM_ROLE_CHANGED', title: 'Your team role changed' },
    TEAM_OWNERSHIP_TRANSFERRED: {
      type: 'TEAM_OWNERSHIP_TRANSFERRED',
      title: 'Team ownership was transferred',
    },
    TEAM_COMPLETED: { type: 'TEAM_COMPLETED', title: 'A team was completed' },
    TEAM_MEMBER_JOINED: { type: 'TEAM_MEMBER_JOINED', title: 'A team member joined' },
    PROJECT_COMPLETED: { type: 'PROJECT_COMPLETED', title: 'A project was completed' },
    PROJECT_INVITATION_SENT: {
      type: 'PROJECT_INVITATION_SENT',
      title: 'You received a project invitation',
    },
    PROJECT_JOIN_REQUESTED: {
      type: 'PROJECT_JOIN_REQUESTED',
      title: 'A project join request needs review',
    },
    PROJECT_JOIN_REQUEST_APPROVED: {
      type: 'PROJECT_JOIN_REQUEST_APPROVED',
      title: 'Your project join request was approved',
    },
    PROJECT_JOIN_REQUEST_REJECTED: {
      type: 'PROJECT_JOIN_REQUEST_REJECTED',
      title: 'Your project join request was declined',
    },
    PROJECT_OWNERSHIP_TRANSFERRED: {
      type: 'PROJECT_OWNERSHIP_TRANSFERRED',
      title: 'Project ownership was transferred',
    },
    EVENT_UPDATED: { type: 'EVENT_UPDATED', title: 'An event you registered for was updated' },
    EVENT_CANCELLED: {
      type: 'EVENT_CANCELLED',
      title: 'An event you registered for was cancelled',
    },
    EVENT_ARCHIVED: { type: 'EVENT_ARCHIVED', title: 'An event was archived' },
    EVENT_REGISTRATION_CONFIRMED: {
      type: 'EVENT_REGISTRATION_CONFIRMED',
      title: 'Your event registration is confirmed',
    },
    EVENT_REGISTRATION_CANCELLED: {
      type: 'EVENT_REGISTRATION_CANCELLED',
      title: 'Your event registration was cancelled',
    },
    TASK_ASSIGNED: { type: 'TASK_ASSIGNED', title: 'A project task was assigned to you' },
    TASK_COMPLETED: { type: 'TASK_COMPLETED', title: 'A project task was completed' },
    MILESTONE_COMPLETED: {
      type: 'MILESTONE_COMPLETED',
      title: 'A project milestone was completed',
    },
    COMMUNITY_JOINED: { type: 'COMMUNITY_JOINED', title: 'A new community member joined' },
    COMMUNITY_JOIN_REQUESTED: {
      type: 'COMMUNITY_JOIN_REQUESTED',
      title: 'A community join request needs review',
    },
    COMMUNITY_JOIN_REQUEST_APPROVED: {
      type: 'COMMUNITY_JOIN_REQUEST_APPROVED',
      title: 'Your community join request was approved',
    },
    COMMUNITY_JOIN_REQUEST_REJECTED: {
      type: 'COMMUNITY_JOIN_REQUEST_REJECTED',
      title: 'Your community join request was declined',
    },
    COMMUNITY_INVITATION_SENT: {
      type: 'COMMUNITY_INVITATION_SENT',
      title: 'You received a community invitation',
    },
    COMMUNITY_INVITATION_ACCEPTED: {
      type: 'COMMUNITY_INVITATION_ACCEPTED',
      title: 'Your community invitation was accepted',
    },
    COMMUNITY_MEMBER_REMOVED: {
      type: 'COMMUNITY_MEMBER_REMOVED',
      title: 'You were removed from a community',
    },
    COMMUNITY_MEMBER_BANNED: {
      type: 'COMMUNITY_MEMBER_BANNED',
      title: 'You were banned from a community',
    },
    COMMUNITY_MEMBER_UNBANNED: {
      type: 'COMMUNITY_MEMBER_UNBANNED',
      title: 'Your community ban was lifted',
    },
    COMMUNITY_REPORT_CREATED: {
      type: 'COMMUNITY_REPORT_CREATED',
      title: 'A community report needs review',
    },
    MESSAGE_SENT: { type: 'MESSAGE_SENT', title: 'You have a new message' },
  };
  return values[eventType] ?? { type: eventType, title: 'You have a new CampusConnection update' };
}

async function notificationRecipients(event: EventRecord): Promise<string[]> {
  const payload = payloadOf(event);
  if (['EVENT_REGISTRATION_CONFIRMED', 'EVENT_REGISTRATION_CANCELLED'].includes(event.eventType)) {
    const recipientId = id(payload.recipientId) ?? event.actorId;
    return recipientId ? [recipientId] : [];
  }
  if (
    ['EVENT_UPDATED', 'EVENT_CANCELLED', 'EVENT_ARCHIVED'].includes(event.eventType) &&
    id(payload.eventId)
  ) {
    const registrations = await EventRegistrationModel.find({
      eventId: id(payload.eventId),
      status: { $in: ['REGISTERED', 'ATTENDED'] },
    })
      .select('userId')
      .lean()
      .exec();
    return registrations
      .map((registration) => registration.userId.toString())
      .filter((userId) => userId !== event.actorId);
  }
  if (event.eventType === 'MESSAGE_SENT') {
    const conversationId = id(payload.conversationId);
    if (!conversationId) return [];
    const [members, message] = await Promise.all([
      ConversationMemberModel.find({ conversationId, status: 'ACTIVE' })
        .select('userId')
        .lean()
        .exec(),
      id(payload.messageId)
        ? MessageModel.findById(id(payload.messageId)).select('senderId').lean().exec()
        : Promise.resolve(undefined),
    ]);
    const senderId = message?.senderId?.toString() ?? event.actorId;
    const redis = getRedisClient();
    const recipientIds = members
      .map((member) => member.userId.toString())
      .filter((userId) => userId !== senderId);
    const viewing = await Promise.all(
      recipientIds.map(async (recipientId) => ({
        recipientId,
        active: (await redis.exists(conversationPresenceKey(conversationId, recipientId))) === 1,
      })),
    );
    return viewing.filter((item) => !item.active).map((item) => item.recipientId);
  }
  if (event.eventType === 'COMMENT_CREATED') {
    const postId = id(payload.postId);
    if (!postId) return [];
    const post = await PostModel.findById(postId).select('authorId').lean().exec();
    const recipientId = post?.authorId?.toString();
    return recipientId && recipientId !== event.actorId ? [recipientId] : [];
  }
  if (event.eventType === 'REPLY_CREATED') {
    const discussionId = id(payload.discussionId);
    if (!discussionId) return [];
    const discussion = await DiscussionModel.findById(discussionId)
      .select('authorId')
      .lean()
      .exec();
    const recipientId = discussion?.authorId?.toString();
    return recipientId && recipientId !== event.actorId ? [recipientId] : [];
  }
  if (event.eventType === 'REACTION_ADDED') {
    const targetId = id(payload.targetId);
    const targetType = id(payload.targetType);
    if (!targetId || !targetType) return [];
    const target =
      targetType === 'COMMENT'
        ? await CommentModel.findById(targetId).select('authorId').lean().exec()
        : targetType === 'POST'
          ? await PostModel.findById(targetId).select('authorId').lean().exec()
          : null;
    const recipientId = target?.authorId?.toString();
    return recipientId && recipientId !== event.actorId ? [recipientId] : [];
  }
  return [id(payload.targetUserId), id(payload.recipientId), id(payload.userId)].filter(
    (item): item is string => Boolean(item && item !== event.actorId),
  );
}

function notificationPreferenceField(eventType: string): string {
  if (eventType === 'MESSAGE_SENT') return 'messages';
  if (eventType.startsWith('TEAM_')) return 'teamActivity';
  if (
    eventType.startsWith('PROJECT_') ||
    eventType.startsWith('TASK_') ||
    eventType.startsWith('MILESTONE_')
  )
    return 'projectActivity';
  if (eventType.startsWith('COMMUNITY_')) return 'communityActivity';
  if (eventType.startsWith('EVENT_')) return 'eventUpdates';
  return 'socialInteractions';
}

async function respectNotificationPreferences(eventType: string, recipientIds: string[]) {
  if (!recipientIds.length) return recipientIds;
  const field = `preferences.notifications.${notificationPreferenceField(eventType)}`;
  const users = await UserModel.find({ _id: { $in: recipientIds }, [field]: { $ne: false } })
    .select('_id')
    .lean()
    .exec();
  const allowed = new Set(users.map((user) => user._id.toString()));
  return recipientIds.filter((recipientId) => allowed.has(recipientId));
}

export async function handleNotificationEvent(event: EventRecord): Promise<void> {
  const recipients = await respectNotificationPreferences(
    event.eventType,
    await notificationRecipients(event),
  );
  const text = notificationText(event.eventType);
  const payload = payloadOf(event);
  const metadata = notificationMetadata(payload, await notificationContext(event, payload));
  await Promise.all(
    recipients.map((recipientId) =>
      NotificationModel.updateOne(
        { sourceEventId: event.eventId, recipientId },
        {
          $setOnInsert: {
            recipientId,
            sourceEventId: event.eventId,
            type: text.type,
            title: text.title,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            ...(event.actorId ? { actorId: event.actorId } : {}),
            ...(metadata ? { metadata } : {}),
            ...(event.eventType === 'TEAM_INVITATION_SENT'
              ? { body: 'You were invited to join this team.' }
              : {}),
            ...(id(payload.conversationId)
              ? { body: 'Open CampusConnection to view the conversation.' }
              : {}),
          },
        },
        { upsert: true },
      ).exec(),
    ),
  );
}
