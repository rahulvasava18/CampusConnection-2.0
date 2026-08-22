import { apiRequest } from '../auth/auth.api';
import type { ApiCollection, ClubStatus } from '@campusconnection/shared';

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

export function getAdminStats(range: AdminStatsRange = '30d'): Promise<AdminStats> {
  return apiRequest<AdminStats>(`/admin/stats?range=${range}`);
}

export type AdminUserStatus =
  | 'PENDING_VERIFICATION'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'BANNED'
  | 'DELETED';
export type AdminUserSort = 'createdAt' | 'lastActive' | 'activity' | 'reports';
export type AdminUserOrder = 'asc' | 'desc';
export type AdminActivityFilter = 'all' | 'recent' | 'inactive';
export type AdminReportFilter = 'any' | 'reported' | 'frequent';
export type SuspensionDuration = '24h' | '3d' | '7d' | '30d' | 'indefinite';

export interface AdminUserSummary {
  id: string;
  displayName: string;
  username: string;
  email: string;
  college?: string;
  course?: string;
  avatarUrl?: string;
  accountState: AdminUserStatus;
  roles: string[];
  createdAt: string;
  lastActiveAt?: string;
  postsCount: number;
  commentsCount: number;
  reportsCount: number;
}

export interface AdminUsersQuery {
  search?: string;
  status?: AdminUserStatus;
  college?: string;
  activity?: AdminActivityFilter;
  reports?: AdminReportFilter;
  joined?: 'today' | '7d' | '30d' | '90d';
  sort?: AdminUserSort;
  order?: AdminUserOrder;
  page?: number;
  limit?: 25 | 50 | 100;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AdminUserOverview {
  user: AdminUserSummary;
  account: {
    status: string;
    joinedAt: string;
    lastActiveAt?: string;
    suspension?: { until: string; reason?: string };
    banReason?: string;
  };
  activity: { posts: number; comments: number; teams: number; communities: number; events: number };
  reports: { aboutUser: number; createdByUser: number; open: number; resolved: number };
  moderation: { warnings: number; suspensions: number; bans: number };
}

export interface AdminActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface AdminContentItem {
  id: string;
  type: string;
  preview: string;
  createdAt: string;
  status: string;
  engagement: number;
  reportCount: number;
}

export interface AdminReportItem {
  id: string;
  direction: 'ABOUT_USER' | 'CREATED_BY_USER';
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  resolution?: string;
  reviewedBy?: string;
  createdAt: string;
}

export interface AdminModerationHistoryItem {
  id: string;
  action: 'WARNING' | 'SUSPENSION' | 'BAN' | 'RESTORE' | 'SOFT_DELETE';
  label: string;
  reason: string;
  adminId: string;
  relatedContentId?: string;
  expiresAt?: string;
  createdAt: string;
}

function adminQuery(input: AdminUsersQuery): string {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export const getAdminUsers = (input: AdminUsersQuery = {}) =>
  apiRequest<AdminUserListResult>(`/admin/users?${adminQuery(input)}`);
export const getAdminUser = (userId: string) =>
  apiRequest<AdminUserOverview>(`/admin/users/${userId}`);
export const getAdminUserActivity = (userId: string) =>
  apiRequest<AdminActivityItem[]>(`/admin/users/${userId}/activity`);
export const getAdminUserContent = (userId: string) =>
  apiRequest<AdminContentItem[]>(`/admin/users/${userId}/content`);
export const getAdminUserReports = (userId: string) =>
  apiRequest<AdminReportItem[]>(`/admin/users/${userId}/reports`);
export const getAdminUserModerationHistory = (userId: string) =>
  apiRequest<AdminModerationHistoryItem[]>(`/admin/users/${userId}/moderation-history`);

export const warnAdminUser = (userId: string, input: { reason: string; relatedContentId?: string; notifyUser: boolean }) =>
  apiRequest<AdminUserSummary>(`/admin/users/${userId}/warn`, { method: 'POST', body: JSON.stringify(input) });
export const suspendAdminUser = (userId: string, input: { duration: SuspensionDuration; reason: string; notifyUser: boolean }) =>
  apiRequest<AdminUserSummary>(`/admin/users/${userId}/suspend`, { method: 'POST', body: JSON.stringify(input) });
export const banAdminUser = (userId: string, input: { reason: string; confirmation: 'BAN'; notifyUser: boolean }) =>
  apiRequest<AdminUserSummary>(`/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify(input) });
export const restoreAdminUser = (userId: string, input: { notifyUser: boolean }) =>
  apiRequest<AdminUserSummary>(`/admin/users/${userId}/restore`, { method: 'POST', body: JSON.stringify(input) });
export const deleteAdminUser = (userId: string, input: { reason: string; confirmation: 'DELETE' }) =>
  apiRequest<AdminUserSummary>(`/admin/users/${userId}`, { method: 'DELETE', body: JSON.stringify(input) });

export type AdminReportTargetType = 'USER' | 'POST' | 'COMMENT' | 'TEAM' | 'COMMUNITY' | 'EVENT';
export type AdminReportReason = 'SPAM' | 'HARASSMENT' | 'ABUSE' | 'MISLEADING_INFORMATION' | 'IMPERSONATION' | 'SCAM' | 'INAPPROPRIATE_CONTENT' | 'OTHER';
export type AdminReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type AdminReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface AdminReport {
  id: string;
  reporter?: { id: string; displayName: string; username: string; avatarUrl?: string };
  target: { type: AdminReportTargetType; id: string; owner?: { id: string; displayName: string; username: string }; content?: { title: string; preview: string; status: string } };
  reason: AdminReportReason;
  description?: string;
  priority: AdminReportPriority;
  status: AdminReportStatus;
  reportCount: number;
  resolution?: string;
  resolutionReason?: string;
  createdAt: string;
  updatedAt: string;
}
export interface AdminReportList { reports: AdminReport[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface AdminReportQuery { search?: string; status?: AdminReportStatus; priority?: AdminReportPriority; reason?: AdminReportReason; targetType?: AdminReportTargetType; page?: number; limit?: number }
export interface AdminReportDetail { report: AdminReport; relatedReports: AdminReport[]; moderationHistory: AdminModerationHistoryItem[] }

function queryString(input: object) {
  const query = new URLSearchParams();
  Object.entries(input as Record<string, string | number | boolean | undefined>).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
  return query.toString();
}
export const createAdminReport = (input: { targetType: AdminReportTargetType; targetId: string; reason: AdminReportReason; description?: string }) =>
  apiRequest<{ id: string; status: string; createdAt: string }>('/reports', { method: 'POST', body: JSON.stringify(input) });
export const getAdminReports = (input: AdminReportQuery = {}) => apiRequest<AdminReportList>(`/admin/reports?${queryString(input)}`);
export const getAdminReport = (reportId: string) => apiRequest<AdminReportDetail>(`/admin/reports/${reportId}`);
export const reviewAdminReport = (reportId: string, input: { status: AdminReportStatus; reason?: string }) => apiRequest<{ id: string; status: string }>(`/admin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(input) });
export const resolveAdminReport = (reportId: string, reason: string) => apiRequest<{ id: string; status: string }>(`/admin/reports/${reportId}/resolve`, { method: 'POST', body: JSON.stringify({ reason }) });
export const dismissAdminReport = (reportId: string, reason: string) => apiRequest<{ id: string; status: string }>(`/admin/reports/${reportId}/dismiss`, { method: 'POST', body: JSON.stringify({ reason }) });

export type AdminContentType = Exclude<AdminReportTargetType, 'USER'>;
export interface AdminModerationContentItem { id: string; type: AdminContentType; title: string; preview: string; ownerId: string; status: string; createdAt: string; engagement: number; reportCount: number }
export interface AdminContentList { items: AdminModerationContentItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export const getAdminContent = (type: AdminContentType, input: { search?: string; status?: string; page?: number; limit?: number } = {}) => apiRequest<AdminContentList>(`/admin/content/${type}?${queryString(input)}`);
export const moderateAdminContent = (type: AdminContentType, contentId: string, input: { action: 'HIDE' | 'DELETE' | 'RESTORE' | 'DISABLE' | 'CANCEL'; reason: string; confirmation?: string }) => apiRequest<{ id: string; status: string; action: string }>(`/admin/content/${type}/${contentId}/moderate`, { method: 'POST', body: JSON.stringify(input) });

export interface AdminClubItem { id: string; name: string; slug: string; category: string; privacy: 'PUBLIC' | 'PRIVATE'; status: ClubStatus; ownerId: string; description: string; contactEmail: string; rejectionReason?: string; createdAt: string; updatedAt: string }
export const getAdminClubs = (status?: ClubStatus) => apiRequest<ApiCollection<AdminClubItem>>(`/admin/clubs?limit=100${status ? `&status=${status}` : ''}`);
export const reviewAdminClub = (clubId: string, status: Exclude<ClubStatus, 'PENDING'>, reason?: string) => apiRequest<ApiCollection<AdminClubItem>>(`/admin/clubs/${clubId}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(reason ? { reason } : {}) }) });

export interface AdminAuditItem { id: string; action: string; targetType?: string; targetId?: string; reason?: string; metadata: Record<string, unknown>; actor?: { id: string; displayName: string; username: string; avatarUrl?: string }; createdAt: string }
export interface AdminAuditList { items: AdminAuditItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export const getAdminAuditLogs = (input: { search?: string; action?: string; targetType?: string; page?: number; limit?: number } = {}) => apiRequest<AdminAuditList>(`/admin/audit-logs?${queryString(input)}`);
export const getAdminAuditLog = (id: string) => apiRequest<AdminAuditItem>(`/admin/audit-logs/${id}`);

export interface AdminNotification { id: string; type: string; title: string; body?: string; priority: string; readAt?: string; entityType: string; entityId: string; createdAt: string }
export interface AdminNotificationList { items: AdminNotification[]; unreadCount: number; pagination: { page: number; limit: number; total: number; totalPages: number } }
export const getAdminNotifications = (input: { unread?: boolean; page?: number; limit?: number } = {}) => apiRequest<AdminNotificationList>(`/admin/notifications?${queryString({ ...input, unread: input.unread === undefined ? undefined : String(input.unread) })}`);
export const markAdminNotificationRead = (id: string) => apiRequest<{ id: string; readAt?: string }>(`/admin/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({}) });
export const markAllAdminNotificationsRead = () => apiRequest<{ updatedCount: number }>('/admin/notifications/read-all', { method: 'POST', body: JSON.stringify({}) });

export interface AdminAnalytics { range: AdminStatsRange; generatedAt: string; overview: Record<string, number>; accountStates: Array<{ label: string; value: number }>; reportReasons: Array<{ label: string; value: number }>; reportTargets: Array<{ label: string; value: number }>; activity: Array<Record<string, string | number>>; platformHealth: { activeUsers: number; contentCreation: number; reports: number; moderationBacklog: number } }
export const getAdminAnalytics = (range: AdminStatsRange = '30d') => apiRequest<AdminAnalytics>(`/admin/analytics?range=${range}`);
export interface SuspiciousSignal { id: string; risk: string; signal: string; user?: { _id?: string; displayName: string; username: string; avatarUrl?: string }; targetType?: string; targetId?: string; evidence: Record<string, number> }
export const getAdminSuspiciousActivity = () => apiRequest<{ generatedAt: string; signals: SuspiciousSignal[] }>('/admin/moderation');
