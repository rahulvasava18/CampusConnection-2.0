import { type Document, type Model } from 'mongoose';
import { UserModel } from '../../identity/infrastructure/user.model';
import { SessionModel } from '../../identity/infrastructure/session.model';
import { ModerationHistoryModel } from '../infrastructure/admin.models';
import { AdminReportModel } from '../infrastructure/control.models';
import { CommentModel, PostModel } from '../../social/infrastructure/social.models';
import {
  CommunityModel,
  EventModel,
  EventRegistrationModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';

export type AnalyticsRange = '7d' | '30d' | '90d' | '6m' | '1y';

const daysFor: Record<AnalyticsRange, number> = { '7d': 7, '30d': 30, '90d': 90, '6m': 183, '1y': 365 };

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function buckets(range: AnalyticsRange, now: Date) {
  const end = startOfDay(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysFor[range] + 1);
  const values: Array<{ date: string; start: Date; end: Date }> = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const itemStart = new Date(cursor);
    const itemEnd = new Date(itemStart);
    itemEnd.setUTCDate(itemEnd.getUTCDate() + 1);
    values.push({ date: itemStart.toISOString().slice(0, 10), start: itemStart, end: itemEnd });
  }
  return values;
}

async function dailyCounts(model: Model<Document>, start: Date) {
  const rows = await model.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]).exec();
  return new Map(rows.map((row) => [row._id, row.count]));
}

async function activeDaily(start: Date) {
  const rows = await SessionModel.aggregate<{ _id: string; users: string[] }>([
    { $match: { lastUsedAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastUsedAt' } }, users: { $addToSet: '$userId' } } },
  ]).exec();
  return new Map(rows.map((row) => [row._id, row.users.length]));
}

export class AdminAnalyticsService {
  async getAnalytics(range: AnalyticsRange) {
    const now = new Date();
    const series = buckets(range, now);
    const start = series[0]?.start ?? startOfDay(now);
    const [users, active, posts, comments, teams, communities, events, registrations, reportRows, moderationRows, stateRows, reasonRows, targetRows] = await Promise.all([
      dailyCounts(UserModel as unknown as Model<Document>, start),
      activeDaily(start),
      dailyCounts(PostModel as unknown as Model<Document>, start),
      dailyCounts(CommentModel as unknown as Model<Document>, start),
      dailyCounts(TeamModel as unknown as Model<Document>, start),
      dailyCounts(CommunityModel as unknown as Model<Document>, start),
      dailyCounts(EventModel as unknown as Model<Document>, start),
      dailyCounts(EventRegistrationModel as unknown as Model<Document>, start),
      AdminReportModel.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }]).exec(),
      ModerationHistoryModel.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: '$action', count: { $sum: 1 } } }]).exec(),
      UserModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$accountState', count: { $sum: 1 } } }]).exec(),
      AdminReportModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$reason', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).exec(),
      AdminReportModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$targetType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).exec(),
    ]);
    const [totalUsers, activeUsers, inactiveUsers, suspended, banned, deleted, totalPosts, totalComments, totalTeams, totalCommunities, totalEvents, totalReports, pendingReports, resolvedReports, dismissedReports] = await Promise.all([
      UserModel.countDocuments().exec(), UserModel.countDocuments({ accountState: 'ACTIVE' }).exec(), UserModel.countDocuments({ accountState: { $nin: ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] } }).exec(), UserModel.countDocuments({ accountState: 'SUSPENDED' }).exec(), UserModel.countDocuments({ accountState: 'BANNED' }).exec(), UserModel.countDocuments({ accountState: 'DELETED' }).exec(), PostModel.countDocuments({ status: 'ACTIVE' }).exec(), CommentModel.countDocuments({ status: 'ACTIVE' }).exec(), TeamModel.countDocuments({ status: { $ne: 'ARCHIVED' } }).exec(), CommunityModel.countDocuments({ status: { $ne: 'DELETED' } }).exec(), EventModel.countDocuments({ status: { $ne: 'CANCELLED' } }).exec(), AdminReportModel.countDocuments().exec(), AdminReportModel.countDocuments({ status: { $in: ['PENDING', 'UNDER_REVIEW'] } }).exec(), AdminReportModel.countDocuments({ status: 'RESOLVED' }).exec(), AdminReportModel.countDocuments({ status: 'DISMISSED' }).exec(),
    ]);
    const moderation = Object.fromEntries(moderationRows.map((row) => [row._id, row.count]));
    return {
      range,
      generatedAt: now.toISOString(),
      overview: { totalUsers, activeUsers, inactiveUsers, suspended, banned, deleted, totalPosts, totalComments, totalTeams, totalCommunities, totalEvents, totalReports, pendingReports, resolvedReports, dismissedReports, warnings: moderation.WARNING ?? 0, suspensions: moderation.SUSPENSION ?? 0, bans: moderation.BAN ?? 0, deletedContent: (moderation.CONTENT_DELETE ?? 0) + (moderation.TEAM_DELETE ?? 0) + (moderation.COMMUNITY_DELETE ?? 0) + (moderation.EVENT_DELETE ?? 0) },
      accountStates: stateRows.map((row) => ({ label: row._id, value: row.count })),
      reportReasons: reasonRows.map((row) => ({ label: row._id, value: row.count })),
      reportTargets: targetRows.map((row) => ({ label: row._id, value: row.count })),
      activity: series.map((item) => ({ date: item.date, users: users.get(item.date) ?? 0, activeUsers: active.get(item.date) ?? 0, posts: posts.get(item.date) ?? 0, comments: comments.get(item.date) ?? 0, teams: teams.get(item.date) ?? 0, communities: communities.get(item.date) ?? 0, events: events.get(item.date) ?? 0, registrations: registrations.get(item.date) ?? 0, reports: reportRows.find((row) => row._id === item.date)?.count ?? 0 })),
      platformHealth: { activeUsers, contentCreation: totalPosts + totalComments, reports: totalReports, moderationBacklog: pendingReports },
    };
  }
}
