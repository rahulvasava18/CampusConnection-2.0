export const NOTIFICATION_CATEGORIES = [
  'SOCIAL',
  'TEAMS',
  'PROJECTS',
  'COMMUNITIES',
  'EVENTS',
  'MESSAGES',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type NotificationFilter = 'ALL' | 'UNREAD' | NotificationCategory;

export interface NotificationView {
  id: string;
  type: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  readAt?: string;
  createdAt: string;
  targetPath: string;
  actionLabel: string;
}

export interface NotificationUnreadCount {
  unreadCount: number;
}
