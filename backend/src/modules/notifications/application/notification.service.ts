import { Types } from 'mongoose';
import type {
  ApiCollection,
  NotificationCategory,
  NotificationUnreadCount,
  NotificationView,
} from '@campusconnection/shared';
import { decodeCursor, encodeCursor } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import {
  NotificationModel,
  type NotificationDocument,
} from '../../../infrastructure/async/async.models';

export interface NotificationActor {
  userId: string;
  accountState: string;
}

export type NotificationFilter =
  'ALL' | 'UNREAD' | 'SOCIAL' | 'TEAMS' | 'PROJECTS' | 'COMMUNITIES' | 'EVENTS' | 'MESSAGES';

const categoryTypes: Record<Exclude<NotificationFilter, 'ALL' | 'UNREAD'>, string[]> = {
  SOCIAL: [
    'CONNECTION_REQUESTED',
    'CONNECTION_ACCEPTED',
    'REACTION_ADDED',
    'COMMENT_CREATED',
    'REPLY_CREATED',
  ],
  TEAMS: [
    'TEAM_INVITATION_SENT',
    'TEAM_JOIN_REQUESTED',
    'TEAM_JOIN_REQUEST_APPROVED',
    'TEAM_JOIN_REQUEST_REJECTED',
    'TEAM_ROLE_CHANGED',
    'TEAM_OWNERSHIP_TRANSFERRED',
    'TEAM_COMPLETED',
    'TEAM_MEMBER_JOINED',
  ],
  PROJECTS: [
    'PROJECT_COMPLETED',
    'PROJECT_INVITATION_SENT',
    'PROJECT_INVITATION_ACCEPTED',
    'PROJECT_JOIN_REQUESTED',
    'PROJECT_JOIN_REQUEST_APPROVED',
    'PROJECT_JOIN_REQUEST_REJECTED',
    'PROJECT_OWNERSHIP_TRANSFERRED',
    'PROJECT_MEMBER_ADDED',
    'PROJECT_MEMBER_REMOVED',
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'MILESTONE_COMPLETED',
  ],
  COMMUNITIES: [
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
  ],
  EVENTS: [
    'EVENT_UPDATED',
    'EVENT_CANCELLED',
    'EVENT_ARCHIVED',
    'EVENT_REGISTRATION_CONFIRMED',
    'EVENT_REGISTRATION_CANCELLED',
  ],
  MESSAGES: ['MESSAGE_SENT'],
};

function validId(value: string) {
  return Types.ObjectId.isValid(value);
}

function cursorFilter(cursor?: string): Record<string, unknown> {
  if (!cursor) return {};
  try {
    const position = decodeCursor(cursor);
    const createdAt = new Date(position.createdAt);
    if (!validId(position.id) || Number.isNaN(createdAt.valueOf())) throw new Error();
    return {
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: new Types.ObjectId(position.id) } },
      ],
    };
  } catch {
    throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
  }
}

export function notificationCategoryForType(type: string): NotificationCategory {
  const entry = (Object.entries(categoryTypes) as Array<[NotificationCategory, string[]]>).find(
    ([, types]) => types.includes(type),
  );
  return entry?.[0] ?? 'SOCIAL';
}

function metadataId(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && validId(value) ? value : undefined;
}

export function notificationTarget(
  type: string,
  aggregateType: string,
  aggregateId: string,
  metadata?: Record<string, unknown>,
): { targetPath: string; actionLabel: string } {
  if (type === 'MESSAGE_SENT' || aggregateType.toUpperCase().includes('MESSAGE'))
    return { targetPath: '/messages', actionLabel: 'Open Messages' };
  const teamId =
    metadataId(metadata, 'teamId') ??
    (aggregateType.toUpperCase() === 'TEAM' ? aggregateId : undefined);
  if (teamId) return { targetPath: `/teams/${teamId}`, actionLabel: 'Open Team' };
  const projectId =
    metadataId(metadata, 'projectId') ??
    (aggregateType.toUpperCase() === 'PROJECT' ? aggregateId : undefined);
  if (projectId) return { targetPath: `/projects/${projectId}`, actionLabel: 'Open Project' };
  const eventId =
    metadataId(metadata, 'eventId') ??
    (aggregateType.toUpperCase() === 'EVENT' ? aggregateId : undefined);
  if (eventId) return { targetPath: `/events/${eventId}`, actionLabel: 'Open Event' };
  const communityId =
    metadataId(metadata, 'communityId') ??
    (aggregateType.toUpperCase() === 'COMMUNITY' ? aggregateId : undefined);
  if (communityId)
    return { targetPath: `/communities/${communityId}`, actionLabel: 'Open Community' };
  if (aggregateType.toUpperCase() === 'USER' || type.startsWith('CONNECTION_'))
    return { targetPath: '/profile', actionLabel: 'View Profile' };
  if (
    aggregateType.toUpperCase() === 'POST' ||
    type === 'COMMENT_CREATED' ||
    type === 'REACTION_ADDED'
  )
    return { targetPath: '/home', actionLabel: 'Open Home' };
  return { targetPath: '/notifications', actionLabel: 'View' };
}

function primitiveMetadata(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result = Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      ['string', 'number', 'boolean'].includes(typeof item),
    ),
  ) as Record<string, string | number | boolean>;
  return Object.keys(result).length ? result : undefined;
}

function view(item: NotificationDocument): NotificationView {
  const metadata = primitiveMetadata(item.metadata);
  const target = notificationTarget(item.type, item.aggregateType, item.aggregateId, metadata);
  return {
    id: item.id,
    type: item.type,
    category: notificationCategoryForType(item.type),
    title: item.title,
    ...(item.body ? { body: item.body } : {}),
    ...(item.actorId ? { actorId: item.actorId } : {}),
    entityType: item.aggregateType,
    entityId: item.aggregateId,
    ...(metadata ? { metadata } : {}),
    ...(item.readAt ? { readAt: item.readAt.toISOString() } : {}),
    createdAt: item.createdAt.toISOString(),
    ...target,
  };
}

export class NotificationService {
  private active(actor: NotificationActor) {
    if (!['ACTIVE', 'RESTRICTED'].includes(actor.accountState))
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot access notifications.', 403);
  }

  async list(
    actor: NotificationActor,
    input: { limit: number; cursor?: string; filter: NotificationFilter },
  ): Promise<ApiCollection<NotificationView>> {
    this.active(actor);
    const filter: Record<string, unknown> = {
      recipientId: actor.userId,
      ...cursorFilter(input.cursor),
    };
    if (input.filter === 'UNREAD') filter.readAt = { $exists: false };
    if (input.filter !== 'ALL' && input.filter !== 'UNREAD')
      filter.type = { $in: categoryTypes[input.filter] };
    const items = await NotificationModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
      .exec();
    const data = items.slice(0, input.limit).map(view);
    const last = items[input.limit - 1];
    return {
      data,
      pagination: {
        hasMore: items.length > input.limit,
        nextCursor:
          items.length > input.limit && last
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
      },
    };
  }

  async unreadCount(actor: NotificationActor): Promise<NotificationUnreadCount> {
    this.active(actor);
    return {
      unreadCount: await NotificationModel.countDocuments({
        recipientId: actor.userId,
        readAt: { $exists: false },
      }).exec(),
    };
  }

  async markRead(actor: NotificationActor, notificationId: string): Promise<NotificationView> {
    this.active(actor);
    if (!validId(notificationId))
      throw new AppError('VALIDATION_ERROR', 'The notification identifier is invalid.', 422);
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipientId: actor.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    ).exec();
    if (!notification)
      throw new AppError('RESOURCE_NOT_FOUND', 'The notification was not found.', 404);
    return view(notification);
  }

  async markAllRead(actor: NotificationActor): Promise<{ updatedCount: number }> {
    this.active(actor);
    const result = await NotificationModel.updateMany(
      { recipientId: actor.userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    ).exec();
    return { updatedCount: result.modifiedCount };
  }
}
