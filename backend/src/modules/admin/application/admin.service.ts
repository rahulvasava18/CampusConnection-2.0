import { AnalyticsEventModel } from '../../../infrastructure/analytics/analytics-event.model';
import type { Document, Model } from 'mongoose';
import {
  CommunityModel,
  CommunityReportModel,
  EventModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { CommentModel, PostModel } from '../../social/infrastructure/social.models';
import { UserModel } from '../../identity/infrastructure/user.model';

export type AdminStatsRange = '7d' | '30d' | '90d' | '6m' | '1y';

export interface AdminStats {
  range: AdminStatsRange;
  generatedAt: string;
  overview: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    totalPosts: number;
    totalComments: number;
    teams: number;
    communities: number;
    events: number;
    pendingReports: number;
    suspendedUsers: number;
    bannedUsers: number;
  };
  accountStates: Array<{ id: string; label: string; value: number }>;
  userGrowth: Array<{ date: string; users: number }>;
  contentGrowth: Array<{
    date: string;
    posts: number;
    comments: number;
    teams: number;
    communities: number;
    events: number;
  }>;
  activity: Array<{ date: string; events: number }>;
}

interface Bucket {
  date: string;
  start: Date;
  end: Date;
}

interface CountRow {
  _id: string;
  count: number;
}

const rangeDays: Record<AdminStatsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 183,
  '1y': 365,
};

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createBuckets(range: AdminStatsRange, now: Date): Bucket[] {
  const days = rangeDays[range];
  const end = startOfDay(now);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const buckets: Bucket[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 1);
    buckets.push({ date: formatDay(bucketStart), start: bucketStart, end: bucketEnd });
  }
  return buckets;
}

async function countsByDay<T extends Document>(model: Model<T>, start: Date): Promise<Map<string, number>> {
  const rows = await model
    .aggregate<CountRow>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .exec();
  return new Map(rows.map((row) => [row._id, row.count]));
}

async function analyticsCountsByDay(start: Date): Promise<Map<string, number>> {
  const rows = await AnalyticsEventModel.aggregate([
    { $match: { occurredAt: { $gte: start } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).exec();
  return new Map(rows.map((row) => [String(row._id), Number(row.count)]));
}

export class AdminService {
  async getStats(range: AdminStatsRange): Promise<AdminStats> {
    const now = new Date();
    const buckets = createBuckets(range, now);
    const start = buckets[0]?.start ?? startOfDay(now);
    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalPosts,
      totalComments,
      teams,
      communities,
      events,
      pendingReports,
      suspendedUsers,
      bannedUsers,
      accountStateRows,
      userCounts,
      postCounts,
      commentCounts,
      teamCounts,
      communityCounts,
      eventCounts,
      activityCounts,
    ] = await Promise.all([
      UserModel.countDocuments().exec(),
      UserModel.countDocuments({ accountState: 'ACTIVE' }).exec(),
      UserModel.countDocuments({ createdAt: { $gte: start } }).exec(),
      PostModel.countDocuments({ status: 'ACTIVE' }).exec(),
      CommentModel.countDocuments({ status: 'ACTIVE' }).exec(),
      TeamModel.countDocuments({ status: { $ne: 'DELETED' } }).exec(),
      CommunityModel.countDocuments({ status: { $ne: 'DELETED' } }).exec(),
      EventModel.countDocuments({ status: { $ne: 'CANCELLED' } }).exec(),
      CommunityReportModel.countDocuments({ status: 'OPEN' }).exec(),
      UserModel.countDocuments({ accountState: 'SUSPENDED' }).exec(),
      UserModel.countDocuments({ accountState: 'BANNED' }).exec(),
      UserModel.aggregate([
        { $group: { _id: '$accountState', value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).exec(),
      countsByDay(UserModel, start),
      countsByDay(PostModel, start),
      countsByDay(CommentModel, start),
      countsByDay(TeamModel, start),
      countsByDay(CommunityModel, start),
      countsByDay(EventModel, start),
      analyticsCountsByDay(start),
    ]);

    return {
      range,
      generatedAt: now.toISOString(),
      overview: {
        totalUsers,
        activeUsers,
        newUsers,
        totalPosts,
        totalComments,
        teams,
        communities,
        events,
        pendingReports,
        suspendedUsers,
        bannedUsers,
      },
      accountStates: accountStateRows.map((row) => ({
        id: String(row._id),
        label: String(row._id).replaceAll('_', ' '),
        value: Number(row.value),
      })),
      userGrowth: buckets.map((bucket) => ({ date: bucket.date, users: userCounts.get(bucket.date) ?? 0 })),
      contentGrowth: buckets.map((bucket) => ({
        date: bucket.date,
        posts: postCounts.get(bucket.date) ?? 0,
        comments: commentCounts.get(bucket.date) ?? 0,
        teams: teamCounts.get(bucket.date) ?? 0,
        communities: communityCounts.get(bucket.date) ?? 0,
        events: eventCounts.get(bucket.date) ?? 0,
      })),
      activity: buckets.map((bucket) => ({ date: bucket.date, events: activityCounts.get(bucket.date) ?? 0 })),
    };
  }
}
