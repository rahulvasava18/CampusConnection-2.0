import { randomUUID } from 'node:crypto';
import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error';
import { withMongoTransaction } from '../../collaboration/application/collaboration.transaction';
import {
  CommunityMemberModel,
  CommunityModel,
  CommunityReportModel,
  EventModel,
  EventRegistrationModel,
  TeamMemberModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { NotificationModel } from '../../notifications/infrastructure/notification.model';
import { CommentModel, PostModel } from '../../social/infrastructure/social.models';
import { SessionModel } from '../../identity/infrastructure/session.model';
import { SecurityAuditModel } from '../../identity/infrastructure/security-audit.model';
import { UserModel, type UserDocument } from '../../identity/infrastructure/user.model';
import { ModerationHistoryModel, type AdminModerationAction } from '../infrastructure/admin.models';

export type AdminUserSort = 'createdAt' | 'lastActive' | 'activity' | 'reports';
export type AdminUserOrder = 'asc' | 'desc';
export type AdminActivityFilter = 'all' | 'recent' | 'inactive';
export type AdminReportFilter = 'any' | 'reported' | 'frequent';
export type SuspensionDuration = '24h' | '3d' | '7d' | '30d' | 'indefinite';

export interface AdminUserListQuery {
  search?: string;
  status?: string;
  college?: string;
  activity: AdminActivityFilter;
  reports: AdminReportFilter;
  joined?: 'today' | '7d' | '30d' | '90d';
  sort: AdminUserSort;
  order: AdminUserOrder;
  page: number;
  limit: number;
}

export interface AdminUserSummary {
  id: string;
  displayName: string;
  username: string;
  email: string;
  college?: string;
  course?: string;
  avatarUrl?: string;
  accountState: string;
  roles: string[];
  createdAt: string;
  lastActiveAt?: string;
  postsCount: number;
  commentsCount: number;
  reportsCount: number;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

type UserActivity = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, string>;
};

type ContentItem = {
  id: string;
  type: string;
  preview: string;
  createdAt: string;
  status: string;
  engagement: number;
  reportCount: number;
};

type ReportItem = {
  id: string;
  direction: 'ABOUT_USER' | 'CREATED_BY_USER';
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  resolution?: string;
  reviewedBy?: string;
  createdAt: string;
};

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value))
    throw new AppError('VALIDATION_ERROR', 'The user identifier is invalid.', 422);
  return new Types.ObjectId(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function actionLabel(action: AdminModerationAction): string {
  return action === 'SOFT_DELETE' ? 'Delete account' : action.toLowerCase();
}

function durationUntil(duration: SuspensionDuration): Date | undefined {
  if (duration === 'indefinite') return undefined;
  const hours: Record<Exclude<SuspensionDuration, 'indefinite'>, number> = {
    '24h': 24,
    '3d': 72,
    '7d': 168,
    '30d': 720,
  };
  return new Date(Date.now() + hours[duration] * 60 * 60 * 1000);
}

function adminSummary(value: Record<string, unknown>): AdminUserSummary {
  return {
    id: String(value.id ?? value._id),
    displayName: String(value.displayName ?? ''),
    username: String(value.username ?? ''),
    email: String(value.email ?? ''),
    ...(typeof value.college === 'string' && value.college ? { college: value.college } : {}),
    ...(typeof value.course === 'string' && value.course ? { course: value.course } : {}),
    ...(typeof value.avatarUrl === 'string' && value.avatarUrl ? { avatarUrl: value.avatarUrl } : {}),
    accountState: String(value.accountState ?? 'UNKNOWN'),
    roles: Array.isArray(value.roles) ? value.roles.map(String) : [],
    createdAt: new Date(String(value.createdAt)).toISOString(),
    ...(value.lastActiveAt ? { lastActiveAt: new Date(String(value.lastActiveAt)).toISOString() } : {}),
    postsCount: Number(value.postsCount ?? 0),
    commentsCount: Number(value.commentsCount ?? 0),
    reportsCount: Number(value.reportsCount ?? 0),
  };
}

function reportTargetFilter(userId: Types.ObjectId): Record<string, unknown> {
  return { targetType: 'MEMBER', targetId: userId };
}

export class AdminUserService {
  public async listUsers(query: AdminUserListQuery): Promise<AdminUserListResult> {
    const match: Record<string, unknown> = {};
    if (query.status) match.accountState = query.status;
    if (query.college) match.college = new RegExp(escapeRegex(query.college), 'i');
    if (query.search) {
      const expression = new RegExp(escapeRegex(query.search), 'i');
      match.$or = [
        { displayName: expression },
        { username: expression },
        { usernameNormalized: expression },
        { email: expression },
        { emailNormalized: expression },
        { college: expression },
      ];
    }
    if (query.joined) {
      const days = query.joined === 'today' ? 1 : Number.parseInt(query.joined, 10);
      match.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const direction = query.order === 'asc' ? 1 : -1;
    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'sessions',
          let: { userId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$userId', '$$userId'] } } },
            { $sort: { lastUsedAt: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, lastUsedAt: 1 } },
          ],
          as: 'lastSession',
        },
      },
      {
        $lookup: {
          from: 'posts',
          let: { userId: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$authorId', '$$userId'] }, status: 'ACTIVE' } }],
          as: 'posts',
        },
      },
      {
        $lookup: {
          from: 'comments',
          let: { userId: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$authorId', '$$userId'] }, status: 'ACTIVE' } }],
          as: 'comments',
        },
      },
      {
        $lookup: {
          from: 'community_reports',
          let: { userId: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$targetId', '$$userId'] }, targetType: 'MEMBER' } }],
          as: 'reports',
        },
      },
      {
        $addFields: {
          lastActiveAt: { $arrayElemAt: ['$lastSession.lastUsedAt', 0] },
          postsCount: { $size: '$posts' },
          commentsCount: { $size: '$comments' },
          reportsCount: { $size: '$reports' },
          activityScore: { $add: [{ $size: '$posts' }, { $size: '$comments' }] },
        },
      },
    ];
    if (query.activity === 'recent')
      pipeline.push({ $match: { lastActiveAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
    if (query.activity === 'inactive')
      pipeline.push({ $match: { $or: [{ lastActiveAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, { lastActiveAt: { $exists: false } }] } });
    if (query.reports === 'reported') pipeline.push({ $match: { reportsCount: { $gt: 0 } } });
    if (query.reports === 'frequent') pipeline.push({ $match: { reportsCount: { $gte: 3 } } });

    const sortField =
      query.sort === 'lastActive'
        ? 'lastActiveAt'
        : query.sort === 'activity'
          ? 'activityScore'
          : query.sort === 'reports'
            ? 'reportsCount'
            : 'createdAt';
    pipeline.push(
      { $sort: { [sortField]: direction, _id: direction } },
      {
        $project: {
          _id: 1,
          displayName: 1,
          username: 1,
          email: 1,
          college: 1,
          course: 1,
          avatarUrl: 1,
          accountState: 1,
          roles: 1,
          createdAt: 1,
          lastActiveAt: 1,
          postsCount: 1,
          commentsCount: 1,
          reportsCount: 1,
        },
      },
      {
        $facet: {
          users: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
          total: [{ $count: 'value' }],
        },
      },
    );
    const [result] = await UserModel.aggregate<{
      users: Record<string, unknown>[];
      total: Array<{ value: number }>;
    }>(pipeline).exec();
    const total = result?.total[0]?.value ?? 0;
    return {
      users: (result?.users ?? []).map(adminSummary),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async getUser(userId: string): Promise<AdminUserSummary> {
    const user = await UserModel.findById(objectId(userId)).lean().exec();
    if (!user) throw new AppError('RESOURCE_NOT_FOUND', 'User not found.', 404);
    const [postsCount, commentsCount, reportsCount, lastSession] = await Promise.all([
      PostModel.countDocuments({ authorId: user._id, status: 'ACTIVE' }).exec(),
      CommentModel.countDocuments({ authorId: user._id, status: 'ACTIVE' }).exec(),
      CommunityReportModel.countDocuments(reportTargetFilter(user._id)).exec(),
      SessionModel.findOne({ userId: user._id }).sort({ lastUsedAt: -1 }).select('lastUsedAt').lean().exec(),
    ]);
    return adminSummary({ ...user, lastActiveAt: lastSession?.lastUsedAt, postsCount, commentsCount, reportsCount });
  }

  public async getUserOverview(userId: string) {
    const id = objectId(userId);
    const user = await UserModel.findById(id).lean().exec();
    if (!user) throw new AppError('RESOURCE_NOT_FOUND', 'User not found.', 404);
    const [summary, comments, teams, communities, events, reports, history, lastSession] = await Promise.all([
      this.getUser(userId),
      CommentModel.countDocuments({ authorId: id, status: 'ACTIVE' }).exec(),
      TeamMemberModel.countDocuments({ userId: id, status: 'ACTIVE' }).exec(),
      CommunityMemberModel.countDocuments({ userId: id, status: 'ACTIVE' }).exec(),
      EventRegistrationModel.countDocuments({ userId: id, status: { $in: ['REGISTERED', 'ATTENDED'] } }).exec(),
      this.getReports(userId),
      this.getModerationHistory(userId),
      SessionModel.findOne({ userId: id }).sort({ lastUsedAt: -1 }).select('lastUsedAt').lean().exec(),
    ]);
    const ownedTeams = await TeamModel.countDocuments({ ownerId: id }).exec();
    const ownedCommunities = await CommunityModel.countDocuments({ ownerId: id }).exec();
    const ownedEvents = await EventModel.countDocuments({ organizerId: id }).exec();
    const warningCount = history.filter((entry) => entry.action === 'WARNING').length;
    const suspensionCount = history.filter((entry) => entry.action === 'SUSPENSION').length;
    const banCount = history.filter((entry) => entry.action === 'BAN').length;
    return {
      user: { ...summary, ...(lastSession ? { lastActiveAt: lastSession.lastUsedAt.toISOString() } : {}) },
      account: {
        status: user.accountState,
        joinedAt: user.createdAt.toISOString(),
        lastActiveAt: lastSession?.lastUsedAt.toISOString(),
        suspension: user.suspendedUntil
          ? { until: user.suspendedUntil.toISOString(), reason: user.suspensionReason }
          : undefined,
        banReason: user.banReason,
      },
      activity: {
        posts: summary.postsCount,
        comments,
        teams: teams + ownedTeams,
        communities: communities + ownedCommunities,
        events: events + ownedEvents,
      },
      reports: {
        aboutUser: reports.filter((report) => report.direction === 'ABOUT_USER').length,
        createdByUser: reports.filter((report) => report.direction === 'CREATED_BY_USER').length,
        open: reports.filter((report) => report.status === 'OPEN').length,
        resolved: reports.filter((report) => ['RESOLVED', 'DISMISSED'].includes(report.status)).length,
      },
      moderation: { warnings: warningCount, suspensions: suspensionCount, bans: banCount },
    };
  }

  public async getActivity(userId: string): Promise<UserActivity[]> {
    const id = objectId(userId);
    await this.assertExists(id);
    const [posts, comments, teams, communities, events] = await Promise.all([
      PostModel.find({ authorId: id }).sort({ createdAt: -1 }).limit(30).select('createdAt type').lean().exec(),
      CommentModel.find({ authorId: id }).sort({ createdAt: -1 }).limit(30).select('createdAt postId').lean().exec(),
      TeamModel.find({ ownerId: id }).sort({ createdAt: -1 }).limit(20).select('createdAt name').lean().exec(),
      CommunityModel.find({ ownerId: id }).sort({ createdAt: -1 }).limit(20).select('createdAt name').lean().exec(),
      EventModel.find({ organizerId: id }).sort({ createdAt: -1 }).limit(20).select('createdAt title').lean().exec(),
    ]);
    return [
      ...posts.map((item) => ({ id: String(item._id), type: 'POST_CREATED', message: `Created a ${item.type.toLowerCase()} post`, createdAt: item.createdAt.toISOString() })),
      ...comments.map((item) => ({ id: String(item._id), type: 'COMMENT_CREATED', message: 'Commented on a post', createdAt: item.createdAt.toISOString(), metadata: { postId: String(item.postId) } })),
      ...teams.map((item) => ({ id: String(item._id), type: 'TEAM_CREATED', message: `Created team ${item.name}`, createdAt: item.createdAt.toISOString() })),
      ...communities.map((item) => ({ id: String(item._id), type: 'COMMUNITY_CREATED', message: `Created community ${item.name}`, createdAt: item.createdAt.toISOString() })),
      ...events.map((item) => ({ id: String(item._id), type: 'EVENT_CREATED', message: `Created event ${item.title}`, createdAt: item.createdAt.toISOString() })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  }

  public async getContent(userId: string): Promise<ContentItem[]> {
    const id = objectId(userId);
    await this.assertExists(id);
    const [posts, comments, teams, communities, events] = await Promise.all([
      PostModel.find({ authorId: id }).sort({ createdAt: -1 }).limit(50).select('content createdAt status').lean().exec(),
      CommentModel.find({ authorId: id }).sort({ createdAt: -1 }).limit(50).select('content createdAt status').lean().exec(),
      TeamModel.find({ ownerId: id }).sort({ createdAt: -1 }).limit(50).select('name description createdAt status memberCount').lean().exec(),
      CommunityModel.find({ ownerId: id }).sort({ createdAt: -1 }).limit(50).select('name description createdAt status memberCount').lean().exec(),
      EventModel.find({ organizerId: id }).sort({ createdAt: -1 }).limit(50).select('title description createdAt status registrationCount').lean().exec(),
    ]);
    const postIds = posts.map((item) => item._id);
    const commentIds = comments.map((item) => item._id);
    const reportRows = await CommunityReportModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { targetId: { $in: [...postIds, ...commentIds] } } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]).exec();
    const reportCounts = new Map(reportRows.map((row) => [String(row._id), row.count]));
    return [
      ...posts.map((item) => ({ id: String(item._id), type: 'POST', preview: item.content.slice(0, 180), createdAt: item.createdAt.toISOString(), status: item.status, engagement: 0, reportCount: reportCounts.get(String(item._id)) ?? 0 })),
      ...comments.map((item) => ({ id: String(item._id), type: 'COMMENT', preview: item.content.slice(0, 180), createdAt: item.createdAt.toISOString(), status: item.status, engagement: 0, reportCount: reportCounts.get(String(item._id)) ?? 0 })),
      ...teams.map((item) => ({ id: String(item._id), type: 'TEAM', preview: `${item.name}: ${item.description}`.slice(0, 180), createdAt: item.createdAt.toISOString(), status: item.status, engagement: item.memberCount, reportCount: 0 })),
      ...communities.map((item) => ({ id: String(item._id), type: 'COMMUNITY', preview: `${item.name}: ${item.description}`.slice(0, 180), createdAt: item.createdAt.toISOString(), status: item.status, engagement: item.memberCount, reportCount: 0 })),
      ...events.map((item) => ({ id: String(item._id), type: 'EVENT', preview: `${item.title}: ${item.description}`.slice(0, 180), createdAt: item.createdAt.toISOString(), status: item.status, engagement: item.registrationCount, reportCount: 0 })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async getReports(userId: string): Promise<ReportItem[]> {
    const id = objectId(userId);
    await this.assertExists(id);
    const [posts, comments] = await Promise.all([
      PostModel.find({ authorId: id }).select('_id').lean().exec(),
      CommentModel.find({ authorId: id }).select('_id').lean().exec(),
    ]);
    const aboutFilter = {
      $or: [
        reportTargetFilter(id),
        { targetType: 'POST', targetId: { $in: posts.map((item) => item._id) } },
        { targetType: 'COMMENT', targetId: { $in: comments.map((item) => item._id) } },
      ],
    };
    const [about, created] = await Promise.all([
      CommunityReportModel.find(aboutFilter).sort({ createdAt: -1 }).limit(200).lean().exec(),
      CommunityReportModel.find({ reporterId: id }).sort({ createdAt: -1 }).limit(200).lean().exec(),
    ]);
    const map = (item: (typeof about)[number], direction: ReportItem['direction']): ReportItem => ({
      id: String(item._id),
      direction,
      targetType: item.targetType,
      targetId: String(item.targetId),
      reason: item.reason,
      status: item.status,
      ...(item.resolution ? { resolution: item.resolution } : {}),
      ...(item.reviewedBy ? { reviewedBy: String(item.reviewedBy) } : {}),
      createdAt: item.createdAt.toISOString(),
    });
    return [...about.map((item) => map(item, 'ABOUT_USER')), ...created.map((item) => map(item, 'CREATED_BY_USER'))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public async getModerationHistory(userId: string) {
    await this.assertExists(objectId(userId));
    const history = await ModerationHistoryModel.find({ userId: objectId(userId) }).sort({ createdAt: -1, _id: -1 }).limit(200).lean().exec();
    return history.map((item) => ({
      id: String(item._id),
      action: item.action,
      label: actionLabel(item.action),
      reason: item.reason,
      adminId: String(item.adminId),
      ...(item.relatedContentId ? { relatedContentId: item.relatedContentId } : {}),
      ...(item.expiresAt ? { expiresAt: item.expiresAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
    }));
  }

  public async warn(adminId: string, userId: string, input: { reason: string; relatedContentId?: string; notifyUser?: boolean }, requestId?: string) {
    return this.moderate(adminId, userId, 'WARNING', input.reason, input.notifyUser ?? true, requestId, { relatedContentId: input.relatedContentId });
  }

  public async suspend(adminId: string, userId: string, input: { duration: SuspensionDuration; reason: string; notifyUser?: boolean }, requestId?: string) {
    const until = durationUntil(input.duration);
    return this.moderate(adminId, userId, 'SUSPENSION', input.reason, input.notifyUser ?? true, requestId, { duration: input.duration, until: until?.toISOString() }, until);
  }

  public async ban(adminId: string, userId: string, input: { reason: string; notifyUser?: boolean }, requestId?: string) {
    return this.moderate(adminId, userId, 'BAN', input.reason, input.notifyUser ?? true, requestId);
  }

  public async restore(adminId: string, userId: string, input: { notifyUser?: boolean }, requestId?: string) {
    return this.moderate(adminId, userId, 'RESTORE', 'Account access restored by a platform administrator.', input.notifyUser ?? true, requestId);
  }

  public async softDelete(adminId: string, userId: string, reason: string, requestId?: string) {
    return this.moderate(adminId, userId, 'SOFT_DELETE', reason, false, requestId);
  }

  private async moderate(
    adminId: string,
    userId: string,
    action: AdminModerationAction,
    reason: string,
    notifyUser: boolean,
    requestId?: string,
    metadata: Record<string, unknown> = {},
    suspensionUntil?: Date,
  ) {
    const adminObjectId = objectId(adminId);
    const targetObjectId = objectId(userId);
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new AppError('MODERATION_REASON_REQUIRED', 'A moderation reason is required.', 422);
    await withMongoTransaction(async (session) => {
      const target = await UserModel.findById(targetObjectId).session(session).exec();
      if (!target) throw new AppError('RESOURCE_NOT_FOUND', 'User not found.', 404);
      if (target.roles.includes('PLATFORM_ADMIN'))
        throw new AppError('ADMIN_TARGET_PROTECTED', 'The platform administrator cannot be moderated.', 403);
      if (action === 'WARNING' && target.accountState === 'DELETED')
        throw new AppError('ACCOUNT_STATE_INVALID', 'A deleted account cannot be warned.', 409);
      if (action === 'SUSPENSION' && target.accountState === 'SUSPENDED')
        throw new AppError('ALREADY_SUSPENDED', 'User is already suspended.', 409);
      if (action === 'BAN' && target.accountState === 'BANNED')
        throw new AppError('ALREADY_BANNED', 'User is already banned.', 409);
      if (action === 'RESTORE' && !['SUSPENDED', 'BANNED'].includes(target.accountState))
        throw new AppError('ACCOUNT_STATE_INVALID', 'Only suspended or banned users can be restored.', 409);
      if (action === 'SOFT_DELETE' && target.accountState === 'DELETED')
        throw new AppError('ALREADY_DELETED', 'User is already deleted.', 409);

      const now = new Date();
      if (action === 'SUSPENSION') {
        target.accountState = 'SUSPENDED';
        target.suspendedAt = now;
        if (suspensionUntil) target.suspendedUntil = suspensionUntil;
        else delete target.suspendedUntil;
        target.suspensionReason = normalizedReason;
      } else if (action === 'BAN') {
        target.accountState = 'BANNED';
        target.bannedAt = now;
        target.banReason = normalizedReason;
        await SessionModel.updateMany({ userId: targetObjectId, status: 'ACTIVE' }, { $set: { status: 'REVOKED', revokedAt: now } }).session(session).exec();
      } else if (action === 'RESTORE') {
        target.accountState = 'ACTIVE';
        delete target.suspendedAt;
        delete target.suspendedUntil;
        delete target.suspensionReason;
        delete target.bannedAt;
        delete target.banReason;
      } else if (action === 'SOFT_DELETE') {
        target.accountState = 'DELETED';
        target.deletedAt = now;
        target.deletedBy = adminId;
        target.deletionReason = normalizedReason;
        await SessionModel.updateMany({ userId: targetObjectId, status: 'ACTIVE' }, { $set: { status: 'REVOKED', revokedAt: now } }).session(session).exec();
      }
      await target.save({ session });
      await ModerationHistoryModel.create([{ userId: targetObjectId, adminId: adminObjectId, action, reason: normalizedReason, metadata, ...(suspensionUntil ? { expiresAt: suspensionUntil } : {}), notifyUser }], { session });
      await SecurityAuditModel.create([{ actorId: adminObjectId, action: `${action === 'SOFT_DELETE' ? 'DELETE' : action}_USER`, targetType: 'User', targetId: userId, requestId, metadata: { reason: normalizedReason, ...metadata } }], { session });
      if (notifyUser) {
        const title = action === 'WARNING' ? 'Account warning' : action === 'SUSPENSION' ? 'Account suspended' : action === 'BAN' ? 'Account access removed' : 'Account access restored';
        const body = action === 'RESTORE' ? 'Your CampusConnection account access has been restored.' : `${title}. Reason: ${normalizedReason}`;
        await NotificationModel.create([{ recipientId: userId, sourceEventId: randomUUID(), actorId: adminId, type: `ACCOUNT_${action}`, title, body, aggregateType: 'USER', aggregateId: userId, metadata: action === 'SUSPENSION' && suspensionUntil ? { expiresAt: suspensionUntil.toISOString() } : {} }], { session });
      }
      return target.id;
    });
    return this.getUser(userId);
  }

  private async assertExists(id: Types.ObjectId): Promise<UserDocument> {
    const user = await UserModel.findById(id).exec();
    if (!user) throw new AppError('RESOURCE_NOT_FOUND', 'User not found.', 404);
    return user;
  }
}
