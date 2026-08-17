import type { SessionView, UserPreferences, UserSettingsView } from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getSettings() {
  return apiRequest<UserSettingsView>('/settings');
}

export function updateSettings(preferences: Partial<UserPreferences>) {
  return apiRequest<UserSettingsView>('/settings', {
    method: 'PATCH',
    body: JSON.stringify({ preferences }),
  });
}

export function getSessions() {
  return apiRequest<SessionView[]>('/me/sessions');
}

export function revokeSession(sessionId: string) {
  return apiRequest<void>(`/me/sessions/${sessionId}`, { method: 'DELETE' });
}

export function revokeOtherSessions() {
  return apiRequest<{ revokedCount: number }>('/me/sessions/revoke-others', { method: 'POST' });
}
