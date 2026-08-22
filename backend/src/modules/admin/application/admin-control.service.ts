import { randomUUID } from 'node:crypto';
import { Types, type Document, type Model } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error';
import { RedisRateLimiter } from '../../../infrastructure/rate-limit/redis-rate-limiter';
import {
  CommunityModel,
  EventModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { CommentModel, PostModel } from '../../social/infrastructure/social.models';
import { UserModel } from '../../identity/infrastructure/user.model';
import { SecurityAuditModel } from '../../identity/infrastructure/security-audit.model';
import { NotificationModel } from '../../notifications/infrastructure/notification.model';
import { ModerationHistoryModel, type AdminModerationAction } from '../infrastructure/admin.models';
import {
  AdminReportModel,
  type AdminReportDocument,
  type AdminReportPriority,
  type AdminReportReason,
  type AdminReportStatus,
  type AdminReportTargetType,
} from '../infrastructure/control.models';

export interface ReportInput {
  targetType: AdminReportTargetType;
  targetId: string;
  reason: AdminReportReason;
  description?: string;
}

export interface ReportQuery {
  search?: string;
  status?: AdminReportStatus;
  priority?: AdminReportPriority;
  reason?: AdminReportReason;
  targetType?: AdminReportTargetType;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'createdAt' | 'priority' | 'reports';
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface ContentQuery {
  targetType: AdminReportTargetType;
  search?: string;
  status?: string;
  page: number;
  limit: number;
}

export type ContentAction = 'HIDE' | 'DELETE' | 'RESTORE' | 'DISABLE' | 'CANCEL';

function id(value: string, label = 'identifier'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new AppError('VALIDATION_ERROR', `The ${label} is invalid.`, 422);
  return new Types.ObjectId(value);
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateValue(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new AppError('VALIDATION_ERROR', `The ${label} is invalid.`, 422);
  return date;
}

function reportView(item: AdminReportDocument, reporter?: Record<string, unknown>, target?: Record<string, unknown>, count = 1) {
  return {
    id: item.id,
    reporter: reporter ? { id: String(reporter._id), displayName: String(reporter.displayName), username: String(reporter.username), ...(reporter.avatarUrl ? { avatarUrl: String(reporter.avatarUrl) } : {}) } : undefined,
    target: { type: item.targetType, id: item.targetId.toString(), ...(target ?? {}) },
    reason: item.reason,
    description: item.description,
    priority: item.priority,
    status: item.status,
    assignedTo: item.assignedTo?.toString(),
    reviewedBy: item.reviewedBy?.toString(),
    reviewedAt: item.reviewedAt?.toISOString(),
    resolution: item.resolution,
    resolutionReason: item.resolutionReason,
    reportCount: count,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

const reportableModels: Record<AdminReportTargetType, Model<Document> | undefined> = {
  USER: UserModel as unknown as Model<Document>,
  POST: PostModel as unknown as Model<Document>,
  COMMENT: CommentModel as unknown as Model<Document>,
  TEAM: TeamModel as unknown as Model<Document>,
  COMMUNITY: CommunityModel as unknown as Model<Document>,
  EVENT: EventModel as unknown as Model<Document>,
};

export class AdminControlService {
  public constructor(private readonly limiter = new RedisRateLimiter()) {}

  async createReport(reporterId: string, input: ReportInput) {
    const reporterObjectId = id(reporterId, 'reporter identifier');
    const targetObjectId = id(input.targetId, 'target identifier');
    const allowed = await this.limiter.consume(`admin-report:${reporterId}`, { limit: 10, windowSeconds: 3600 });
    if (!allowed.allowed) throw new AppError('RATE_LIMITED', 'Too many reports. Please try again later.', 429, { retryAfterSeconds: allowed.retryAfterSeconds });
    const targetModel = reportableModels[input.targetType];
    const target = targetModel ? await targetModel.findById(targetObjectId).lean().exec() : null;
    if (!target) throw new AppError('RESOURCE_NOT_FOUND', 'The reported content was not found.', 404);
    const duplicate = await AdminReportModel.exists({ reporterId: reporterObjectId, targetType: input.targetType, targetId: targetObjectId, status: { $in: ['PENDING', 'UNDER_REVIEW'] } });
    if (duplicate) throw new AppError('DUPLICATE_REPORT', 'You have already reported this content.', 409);
    const report = await AdminReportModel.create({ reporterId: reporterObjectId, targetType: input.targetType, targetId: targetObjectId, reason: input.reason, ...(input.description ? { description: input.description.trim() } : {}) });
    const admins = await UserModel.find({ roles: 'PLATFORM_ADMIN', accountState: 'ACTIVE' }).select('_id').lean().exec();
    const groupKey = `report-group:${input.targetType}:${input.targetId}`;
    await Promise.all(admins.map(async (admin) => {
      const existing = await NotificationModel.findOne({ recipientId: String(admin._id), sourceEventId: groupKey }).exec();
      const count = await AdminReportModel.countDocuments({ targetType: input.targetType, targetId: targetObjectId, status: { $in: ['PENDING', 'UNDER_REVIEW'] } }).exec();
      if (existing) {
        existing.title = `${count} report${count === 1 ? '' : 's'} require review`;
        existing.body = `Multiple users reported the same ${input.targetType.toLowerCase()}.`;
        await existing.save();
      } else {
        await NotificationModel.create({ recipientId: String(admin._id), sourceEventId: groupKey, actorId: reporterId, type: count > 1 ? 'REPORT_SPIKE' : 'NEW_REPORT', title: `${count} report${count === 1 ? '' : 's'} require review`, body: `A ${input.targetType.toLowerCase()} was reported for ${input.reason.toLowerCase().replaceAll('_', ' ')}.`, aggregateType: 'REPORT', aggregateId: report.id, metadata: { targetType: input.targetType, targetId: input.targetId, reportCount: count } });
      }
    }));
    await SecurityAuditModel.create({ actorId: reporterObjectId, action: 'REPORT_CREATED', targetType: input.targetType, targetId: input.targetId, metadata: { reason: input.reason } });
    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  }

  async listReports(input: ReportQuery) {
    const filter: Record<string, unknown> = {};
    if (input.status) filter.status = input.status;
    if (input.priority) filter.priority = input.priority;
    if (input.reason) filter.reason = input.reason;
    if (input.targetType) filter.targetType = input.targetType;
    const dateFrom = dateValue(input.dateFrom, 'dateFrom');
    const dateTo = dateValue(input.dateTo, 'dateTo');
    if (dateFrom || dateTo) filter.createdAt = { ...(dateFrom ? { $gte: dateFrom } : {}), ...(dateTo ? { $lte: dateTo } : {}) };
    if (input.search) filter.$or = [{ description: { $regex: escaped(input.search), $options: 'i' } }, { targetId: Types.ObjectId.isValid(input.search) ? new Types.ObjectId(input.search) : undefined }].filter(Boolean);
    const sortField: Record<string, 1 | -1> = input.sort === 'priority' ? { priority: input.order === 'asc' ? 1 : -1, createdAt: -1, _id: -1 } : { createdAt: input.order === 'asc' ? 1 : -1, _id: input.order === 'asc' ? 1 : -1 };
    const [items, total] = await Promise.all([AdminReportModel.find(filter).sort(sortField).skip((input.page - 1) * input.limit).limit(input.limit).lean().exec(), AdminReportModel.countDocuments(filter).exec()]);
    const reporterIds = items.map((item) => item.reporterId);
    const reporters = await UserModel.find({ _id: { $in: reporterIds } }).select('displayName username avatarUrl').lean().exec();
    const reporterMap = new Map(reporters.map((value) => [String(value._id), value]));
    const counts = await AdminReportModel.aggregate<{ _id: { type: AdminReportTargetType; id: Types.ObjectId }; count: number }>([
      { $match: { $or: items.map((item) => ({ targetType: item.targetType, targetId: item.targetId })) } },
      { $group: { _id: { type: '$targetType', id: '$targetId' }, count: { $sum: 1 } } },
    ]).exec();
    const countMap = new Map(counts.map((row) => [`${row._id.type}:${row._id.id}`, row.count]));
    return { reports: items.map((item) => reportView(item as unknown as AdminReportDocument, reporterMap.get(String(item.reporterId)), undefined, countMap.get(`${item.targetType}:${item.targetId}`) ?? 1)), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async getReport(reportId: string) {
    const report = await AdminReportModel.findById(id(reportId, 'report identifier')).lean().exec();
    if (!report) throw new AppError('RESOURCE_NOT_FOUND', 'The report was not found.', 404);
    const [reporter, related, target] = await Promise.all([
      UserModel.findById(report.reporterId).select('displayName username avatarUrl').lean().exec(),
      AdminReportModel.find({ targetType: report.targetType, targetId: report.targetId }).sort({ createdAt: -1 }).lean().exec(),
      reportableModels[report.targetType]?.findById(report.targetId).lean().exec(),
    ]);
    const targetValue = target as Record<string, unknown> | null;
    const targetOwnerId = targetValue?.authorId ?? targetValue?.ownerId ?? targetValue?.organizerId;
    const owner = targetOwnerId ? await UserModel.findById(targetOwnerId).select('displayName username avatarUrl').lean().exec() : undefined;
    const history = await ModerationHistoryModel.find({ relatedContentId: report.targetId.toString() }).sort({ createdAt: -1 }).limit(50).lean().exec();
    return { report: reportView(report as unknown as AdminReportDocument, reporter ?? undefined, { owner: owner ? { id: String(owner._id), displayName: String(owner.displayName), username: String(owner.username) } : undefined, content: targetValue ? { title: String(targetValue.title ?? targetValue.name ?? ''), preview: String(targetValue.content ?? targetValue.description ?? '').slice(0, 1000), status: String(targetValue.status ?? '') } : undefined }, related.length), relatedReports: related.map((item) => reportView(item as unknown as AdminReportDocument)), moderationHistory: history.map((item) => ({ id: item.id, action: item.action, reason: item.reason, createdAt: item.createdAt.toISOString(), adminId: item.adminId.toString() })) };
  }

  async reviewReport(adminId: string, reportId: string, status: 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED', reason?: string) {
    const normalizedReason = reason?.trim();
    if (['RESOLVED', 'DISMISSED'].includes(status) && !normalizedReason) throw new AppError('VALIDATION_ERROR', 'A resolution reason is required.', 422);
    const report = await AdminReportModel.findById(id(reportId, 'report identifier')).exec();
    if (!report) throw new AppError('RESOURCE_NOT_FOUND', 'The report was not found.', 404);
    report.status = status;
    report.reviewedBy = id(adminId, 'administrator identifier');
    report.reviewedAt = new Date();
    if (normalizedReason) { report.resolution = status === 'RESOLVED' ? 'ACTION_TAKEN' : 'DISMISSED'; report.resolutionReason = normalizedReason; }
    await report.save();
    await SecurityAuditModel.create({ actorId: report.reviewedBy, action: status === 'RESOLVED' ? 'REPORT_RESOLVED' : status === 'DISMISSED' ? 'REPORT_DISMISSED' : 'REPORT_REVIEW_STARTED', targetType: 'REPORT', targetId: report.id, metadata: { reason: normalizedReason } });
    return { id: report.id, status: report.status, reviewedAt: report.reviewedAt.toISOString() };
  }

  async listContent(input: ContentQuery) {
    const search = input.search ? { $or: [{ name: { $regex: escaped(input.search), $options: 'i' } }, { title: { $regex: escaped(input.search), $options: 'i' } }, { content: { $regex: escaped(input.search), $options: 'i' } }, { description: { $regex: escaped(input.search), $options: 'i' } }] } : {};
    const filter = input.status ? { ...search, status: input.status } : search;
    const model = (input.targetType === 'POST' ? PostModel : input.targetType === 'COMMENT' ? CommentModel : input.targetType === 'TEAM' ? TeamModel : input.targetType === 'COMMUNITY' ? CommunityModel : input.targetType === 'EVENT' ? EventModel : undefined) as unknown as Model<Document> | undefined;
    if (!model) throw new AppError('VALIDATION_ERROR', 'This content type is not supported.', 422);
    const [rows, total] = await Promise.all([model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean().exec(), model.countDocuments(filter).exec()]);
    const values = rows as unknown as Array<Record<string, unknown>>;
    const ids = values.map((value) => value._id);
    const reports = await AdminReportModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { targetType: input.targetType, targetId: { $in: ids } } }, { $group: { _id: '$targetId', count: { $sum: 1 } } }]).exec();
    const reportMap = new Map(reports.map((value) => [String(value._id), value.count]));
    return { items: values.map((value) => ({ id: String(value._id), type: input.targetType, title: String(value.title ?? value.name ?? `${input.targetType} ${value._id}`), preview: String(value.content ?? value.description ?? '').slice(0, 220), ownerId: String(value.authorId ?? value.ownerId ?? value.organizerId ?? ''), status: String(value.status ?? 'ACTIVE'), createdAt: (value.createdAt as Date).toISOString(), engagement: Number(value.memberCount ?? value.registrationCount ?? 0), reportCount: reportMap.get(String(value._id)) ?? 0 })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async moderateContent(adminId: string, targetType: Exclude<AdminReportTargetType, 'USER'>, targetId: string, action: ContentAction, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new AppError('MODERATION_REASON_REQUIRED', 'A moderation reason is required.', 422);
    const targetObjectId = id(targetId, 'content identifier');
    const model = (targetType === 'POST' ? PostModel : targetType === 'COMMENT' ? CommentModel : targetType === 'TEAM' ? TeamModel : targetType === 'COMMUNITY' ? CommunityModel : EventModel) as unknown as Model<Document>;
    const target = await model.findById(targetObjectId).exec();
    if (!target) throw new AppError('RESOURCE_NOT_FOUND', 'The content was not found.', 404);
    const previousStatus = String(target.get('status'));
    const nextStatus = targetType === 'POST' || targetType === 'COMMENT' ? (action === 'RESTORE' ? 'ACTIVE' : 'DELETED') : targetType === 'TEAM' ? (action === 'RESTORE' ? 'ACTIVE' : 'ARCHIVED') : targetType === 'COMMUNITY' ? (action === 'RESTORE' ? 'ACTIVE' : action === 'DELETE' ? 'DELETED' : 'ARCHIVED') : (action === 'RESTORE' ? 'UPCOMING' : action === 'CANCEL' ? 'CANCELLED' : 'ARCHIVED');
    target.set('status', nextStatus);
    await target.save();
    const moderationAction: AdminModerationAction = targetType === 'TEAM' ? action === 'RESTORE' ? 'CONTENT_RESTORE' : action === 'DELETE' ? 'TEAM_DELETE' : 'TEAM_DISABLE' : targetType === 'COMMUNITY' ? action === 'RESTORE' ? 'CONTENT_RESTORE' : action === 'DELETE' ? 'COMMUNITY_DELETE' : 'COMMUNITY_DISABLE' : targetType === 'EVENT' ? action === 'RESTORE' ? 'CONTENT_RESTORE' : action === 'CANCEL' ? 'EVENT_CANCEL' : 'EVENT_DELETE' : action === 'RESTORE' ? 'CONTENT_RESTORE' : action === 'DELETE' ? 'CONTENT_DELETE' : 'CONTENT_HIDE';
    await ModerationHistoryModel.create({ userId: target.get('authorId') ?? target.get('ownerId') ?? target.get('organizerId') ?? adminId, adminId: id(adminId, 'administrator identifier'), action: moderationAction, reason: normalizedReason, relatedContentId: targetId, metadata: { targetType, previousStatus, nextStatus }, notifyUser: true });
    await SecurityAuditModel.create({ actorId: id(adminId, 'administrator identifier'), action: moderationAction, targetType, targetId, metadata: { reason: normalizedReason, previousStatus, nextStatus } });
    const ownerId = target.get('authorId') ?? target.get('ownerId') ?? target.get('organizerId');
    if (ownerId) await NotificationModel.create({ recipientId: String(ownerId), sourceEventId: randomUUID(), actorId: adminId, type: 'CONTENT_MODERATION', title: action === 'RESTORE' ? 'Content restored' : 'Content moderated', body: normalizedReason, aggregateType: targetType, aggregateId: targetId, metadata: { action } });
    return { id: targetId, targetType, status: nextStatus, action };
  }

  async listAudit(input: { search?: string; action?: string; targetType?: string; dateFrom?: string; dateTo?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (input.action) filter.action = input.action;
    if (input.targetType) filter.targetType = input.targetType;
    if (input.search) filter.$or = [{ action: { $regex: escaped(input.search), $options: 'i' } }, { targetId: { $regex: escaped(input.search), $options: 'i' } }];
    const from = dateValue(input.dateFrom, 'dateFrom'); const to = dateValue(input.dateTo, 'dateTo');
    if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const [rows, total] = await Promise.all([SecurityAuditModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean().exec(), SecurityAuditModel.countDocuments(filter).exec()]);
    const actorIds = rows.flatMap((row) => row.actorId ? [row.actorId] : []);
    const actors = await UserModel.find({ _id: { $in: actorIds } }).select('displayName username').lean().exec();
    const actorMap = new Map(actors.map((actor) => [String(actor._id), actor]));
    return { items: rows.map((row) => ({ id: row.id, action: row.action, targetType: row.targetType, targetId: row.targetId, reason: typeof row.metadata?.reason === 'string' ? row.metadata.reason : undefined, metadata: row.metadata, actor: row.actorId ? actorMap.get(String(row.actorId)) : undefined, createdAt: row.createdAt.toISOString() })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async getAudit(auditId: string): Promise<{ id: string; action: string; targetType: string | undefined; targetId: string | undefined; requestId: string | undefined; correlationId: string | undefined; metadata: Record<string, unknown>; actor: { id: string; displayName: string; username: string; avatarUrl: string | undefined } | undefined; createdAt: string }> {
    const item = await SecurityAuditModel.findById(id(auditId, 'audit identifier')).lean().exec();
    if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'Audit record not found.', 404);
    const actor = item.actorId ? await UserModel.findById(item.actorId).select('displayName username avatarUrl').lean().exec() : undefined;
    return { id: item.id, action: item.action, targetType: item.targetType, targetId: item.targetId, requestId: item.requestId, correlationId: item.correlationId, metadata: item.metadata, actor: actor ? { id: String(actor._id), displayName: String(actor.displayName), username: String(actor.username), avatarUrl: actor.avatarUrl ? String(actor.avatarUrl) : undefined } : undefined, createdAt: item.createdAt.toISOString() };
  }

  async listAdminNotifications(adminId: string, input: { unread?: boolean; page: number; limit: number }): Promise<{ items: Array<{ id: string; type: string; title: string; body: string | undefined; priority: string; readAt: string | undefined; entityType: string; entityId: string; metadata: Record<string, string | number | boolean> | undefined; createdAt: string }>; unreadCount: number; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const filter: Record<string, unknown> = { recipientId: adminId };
    if (input.unread) filter.readAt = { $exists: false };
    const [items, total, unreadCount] = await Promise.all([NotificationModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean().exec(), NotificationModel.countDocuments(filter).exec(), NotificationModel.countDocuments({ recipientId: adminId, readAt: { $exists: false } }).exec()]);
    return { items: items.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, priority: item.type.includes('CRITICAL') ? 'CRITICAL' : item.type.includes('REPORT') ? 'WARNING' : 'INFO', readAt: item.readAt?.toISOString(), entityType: item.aggregateType, entityId: item.aggregateId, metadata: item.metadata, createdAt: item.createdAt.toISOString() })), unreadCount, pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async markAdminNotificationRead(adminId: string, notificationId: string) {
    const item = await NotificationModel.findOneAndUpdate({ _id: id(notificationId, 'notification identifier'), recipientId: adminId }, { $set: { readAt: new Date() } }, { new: true }).lean().exec();
    if (!item) throw new AppError('RESOURCE_NOT_FOUND', 'Notification not found.', 404);
    return { id: item.id, readAt: item.readAt?.toISOString() };
  }

  async markAllAdminNotificationsRead(adminId: string) {
    const result = await NotificationModel.updateMany({ recipientId: adminId, readAt: { $exists: false } }, { $set: { readAt: new Date() } }).exec();
    return { updatedCount: result.modifiedCount };
  }

  async suspiciousActivity() {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const [burst, reportedTargets, repeatedModeration] = await Promise.all([
      PostModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { createdAt: { $gte: since }, status: 'ACTIVE' } }, { $group: { _id: '$authorId', count: { $sum: 1 } } }, { $match: { count: { $gte: 5 } } }]).exec(),
      AdminReportModel.aggregate<{ _id: { type: string; id: Types.ObjectId }; count: number }>([{ $match: { status: { $in: ['PENDING', 'UNDER_REVIEW'] } } }, { $group: { _id: { type: '$targetType', id: '$targetId' }, count: { $sum: 1 } } }, { $match: { count: { $gte: 3 } } }]).exec(),
      ModerationHistoryModel.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { action: { $in: ['WARNING', 'SUSPENSION', 'BAN'] } } }, { $group: { _id: '$userId', count: { $sum: 1 } } }, { $match: { count: { $gte: 2 } } }]).exec(),
    ]);
    const userIds = [...burst.map((item) => item._id), ...repeatedModeration.map((item) => item._id)];
    const users = await UserModel.find({ _id: { $in: userIds } }).select('displayName username avatarUrl').lean().exec();
    const userMap = new Map(users.map((user) => [String(user._id), user]));
    return { generatedAt: new Date().toISOString(), signals: [
      ...burst.map((item) => ({ id: `burst:${item._id}`, risk: 'HIGH', signal: `${item.count} posts created within 10 minutes`, user: userMap.get(String(item._id)), evidence: { count: item.count } })),
      ...repeatedModeration.map((item) => ({ id: `moderation:${item._id}`, risk: 'MEDIUM', signal: 'Repeated moderation actions', user: userMap.get(String(item._id)), evidence: { count: item.count } })),
      ...reportedTargets.map((item) => ({ id: `reports:${item._id.type}:${item._id.id}`, risk: item.count >= 5 ? 'HIGH' : 'MEDIUM', signal: `${item.count} open reports against the same ${item._id.type.toLowerCase()}`, targetType: item._id.type, targetId: String(item._id.id), evidence: { count: item.count } })),
    ] };
  }
}
