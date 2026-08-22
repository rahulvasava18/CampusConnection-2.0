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

export function setPassword(input: {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest<UserSettingsView>('/settings/password', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function startGooglePasswordRecovery(): Promise<{ authorizationUrl: string }> {
  return apiRequest<{ authorizationUrl: string }>('/auth/google/password-recovery/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function exchangeGooglePasswordRecoveryCode(code: string): Promise<{ verified: true }> {
  return apiRequest<{ verified: true }>('/auth/google/password-recovery/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function setPasswordWithRecovery(input: {
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest<UserSettingsView>('/settings/password/recovery', {
    method: 'POST',
    body: JSON.stringify(input),
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
