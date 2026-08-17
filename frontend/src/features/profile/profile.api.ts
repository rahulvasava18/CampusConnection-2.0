import type { ApiCollection, ProfileView, SocialPostView } from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getProfile(userId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '12', ...(cursor ? { cursor } : {}) });
  return apiRequest<ProfileView>(`/users/${userId}/profile?${query.toString()}`);
}

export type ProfilePostsPage = ApiCollection<SocialPostView>;
