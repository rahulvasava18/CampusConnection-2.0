import type {
  ApiCollection,
  NotificationFilter,
  NotificationUnreadCount,
  NotificationView,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getNotifications(filter: NotificationFilter = 'ALL', cursor?: string) {
  const query = new URLSearchParams({
    limit: '20',
    filter,
    ...(cursor ? { cursor } : {}),
  });
  return apiRequest<ApiCollection<NotificationView>>(`/notifications?${query.toString()}`);
}

export function getUnreadNotificationCount() {
  return apiRequest<NotificationUnreadCount>('/notifications/unread-count');
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<NotificationView>(`/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number }>('/notifications/read-all', { method: 'POST' });
}
