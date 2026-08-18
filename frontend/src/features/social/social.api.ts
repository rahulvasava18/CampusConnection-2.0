import type {
  ApiCollection,
  ConnectionView,
  PostType,
  SocialCommentView,
  SocialPostView,
  Visibility,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getFeed(
  cursor?: string,
  mode: 'personalized' | 'chronological' = 'chronological',
) {
  const query = new URLSearchParams({
    limit: '20',
    mode,
    ...(cursor ? { cursor } : {}),
  });
  return apiRequest<ApiCollection<SocialPostView>>(`/feed?${query.toString()}`);
}
export function getCommunityPosts(communityId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) });
  return apiRequest<ApiCollection<SocialPostView>>(
    `/communities/${communityId}/posts?${query.toString()}`,
  );
}
export type CreatePostInput = {
  type: PostType;
  content: string;
  visibility: Visibility;
  tags: string[];
  link?: string;
  media?: File[];
  communityId?: string;
};

export function createPost(input: CreatePostInput) {
  const files = input.media ?? [];
  if (files.length) {
    const form = new FormData();
    form.append('type', input.type);
    form.append('content', input.content);
    form.append('visibility', input.visibility);
    form.append('tags', JSON.stringify(input.tags));
    if (input.link) form.append('link', input.link);
    if (input.communityId) form.append('communityId', input.communityId);
    files.forEach((file) => form.append('media', file, file.name));
    return apiRequest<SocialPostView>('/posts', { method: 'POST', body: form });
  }
  return apiRequest<SocialPostView>('/posts', {
    method: 'POST',
    body: JSON.stringify({
      type: input.type,
      content: input.content,
      visibility: input.visibility,
      tags: input.tags,
      ...(input.link ? { link: input.link } : {}),
      ...(input.communityId ? { communityId: input.communityId } : {}),
      mediaAssetIds: [],
    }),
  });
}
export function updatePost(postId: string, input: { content: string }) {
  return apiRequest<SocialPostView>(`/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export function deletePost(postId: string) {
  return apiRequest<void>(`/posts/${postId}`, { method: 'DELETE' });
}
export function togglePostReaction(postId: string, reacted: boolean) {
  return apiRequest<void>(`/posts/${postId}/reactions/LIKE`, {
    method: reacted ? 'DELETE' : 'PUT',
  });
}
export function getComments(postId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) });
  return apiRequest<ApiCollection<SocialCommentView>>(
    `/posts/${postId}/comments?${query.toString()}`,
  );
}
export function createComment(postId: string, content: string, parentCommentId?: string) {
  return apiRequest<SocialCommentView>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, ...(parentCommentId ? { parentCommentId } : {}) }),
  });
}
export function updateComment(commentId: string, content: string) {
  return apiRequest<SocialCommentView>(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}
export function deleteComment(commentId: string) {
  return apiRequest<void>(`/comments/${commentId}`, { method: 'DELETE' });
}
export function toggleCommentReaction(commentId: string, reacted: boolean) {
  return apiRequest<void>(`/comments/${commentId}/reactions/LIKE`, {
    method: reacted ? 'DELETE' : 'PUT',
  });
}
export function requestConnection(userId: string) {
  return apiRequest(`/users/${userId}/connection-requests`, { method: 'POST' });
}
export function respondConnection(requestId: string, accepted: boolean) {
  return apiRequest<ConnectionView>(
    `/connection-requests/${requestId}/${accepted ? 'accept' : 'reject'}`,
    { method: 'POST' },
  );
}
export function cancelConnection(userId: string) {
  return apiRequest<void>(`/connections/${userId}`, { method: 'DELETE' });
}
export function blockUser(userId: string) {
  return apiRequest<void>(`/blocks/${userId}`, { method: 'POST' });
}
export function unblockUser(userId: string) {
  return apiRequest<void>(`/blocks/${userId}`, { method: 'DELETE' });
}
export function getConnections(limit = 20) {
  return apiRequest<ApiCollection<ConnectionView>>(`/me/connections?limit=${limit}`);
}
export function getConnectionRequests(direction: 'incoming' | 'outgoing', limit = 20) {
  return apiRequest<ApiCollection<ConnectionView>>(
    `/me/connection-requests?direction=${direction}&limit=${limit}`,
  );
}
