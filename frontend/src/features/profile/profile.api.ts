import type { ApiCollection, ProfileView, SocialPostView, UserView } from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';

export function getProfile(userId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '12', ...(cursor ? { cursor } : {}) });
  return apiRequest<ProfileView>(`/users/${userId}/profile?${query.toString()}`);
}

export type ProfilePostsPage = ApiCollection<SocialPostView>;

export function uploadProfileAvatar(file: Blob, fileName = 'profile-photo.jpg'): Promise<UserView> {
  const form = new FormData();
  form.append('avatar', file, fileName);
  return apiRequest<{ user: UserView }>('/me/avatar', {
    method: 'POST',
    body: form,
  }).then((result) => {
    useAuthStore.getState().setUser(result.user);
    return result.user;
  });
}

export function removeProfileAvatar(): Promise<UserView> {
  return apiRequest<{ user: UserView }>('/me/avatar', { method: 'DELETE' }).then((result) => {
    useAuthStore.getState().setUser(result.user);
    return result.user;
  });
}
