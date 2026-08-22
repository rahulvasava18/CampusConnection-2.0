import type {
  ApiCollection,
  CommunityBanView,
  CommunityInvitationView,
  CommunityJoinRequestView,
  CommunityMemberView,
  CommunityReportView,
  CommunityView,
  DiscussionView,
  ReplyView,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getCommunities(params: { search?: string; category?: string; tags?: string } = {}) {
  const query = new URLSearchParams({ limit: '20' });
  if (params.search) query.set('search', params.search);
  if (params.category && params.category !== 'All') query.set('category', params.category);
  if (params.tags) query.set('tags', params.tags);
  return apiRequest<ApiCollection<CommunityView>>(`/communities?${query.toString()}`);
}

export const getMyCommunities = () =>
  apiRequest<ApiCollection<CommunityView>>('/me/communities?limit=20');

export const getCommunity = (id: string) => apiRequest<CommunityView>(`/communities/${id}`);

export const createCommunity = (input: {
  name: string;
  slug?: string;
  description?: string;
  category: string;
  tags?: string[];
  rules?: string[];
  avatarUrl?: string;
  bannerUrl?: string;
  privacy: 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
}) => apiRequest<CommunityView>('/communities', { method: 'POST', body: JSON.stringify(input) });
export const updateCommunity = (
  id: string,
  input: Partial<{
    name: string;
    description: string;
    category: string;
    tags: string[];
    rules: string[];
    avatarUrl: string;
    bannerUrl: string;
    privacy: 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
  }>,
) =>
  apiRequest<CommunityView>(`/communities/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const deleteCommunity = (id: string) =>
  apiRequest<void>(`/communities/${id}`, { method: 'DELETE' });
export const transferCommunityOwnership = (communityId: string, userId: string) =>
  apiRequest<CommunityView>(`/communities/${communityId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const joinCommunity = (id: string) =>
  apiRequest<CommunityMemberView>(`/communities/${id}/join`, { method: 'POST' });

export const leaveCommunity = (id: string) =>
  apiRequest<void>(`/communities/${id}/leave`, { method: 'POST' });

export const getCommunityMembers = (id: string) =>
  apiRequest<ApiCollection<CommunityMemberView>>(`/communities/${id}/members?limit=50`);

export const updateCommunityMember = (
  communityId: string,
  userId: string,
  input: { role?: 'ADMIN' | 'MODERATOR' | 'MEMBER'; status?: 'ACTIVE' | 'LEFT' | 'BANNED' },
) =>
  apiRequest<CommunityMemberView>(`/communities/${communityId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const getJoinRequests = (communityId: string) =>
  apiRequest<ApiCollection<CommunityJoinRequestView>>(
    `/communities/${communityId}/requests?limit=50`,
  );
export const reviewJoinRequest = (communityId: string, requestId: string, approve: boolean) =>
  apiRequest(
    `/communities/${communityId}/requests/${requestId}/${approve ? 'approve' : 'reject'}`,
    { method: 'POST' },
  );
export const inviteCommunityMember = (communityId: string, inviteeId: string) =>
  apiRequest<CommunityInvitationView>(`/communities/${communityId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ inviteeId }),
  });
export const getCommunityInvitations = () =>
  apiRequest<ApiCollection<CommunityInvitationView>>('/community-invitations?limit=50');
export const respondToCommunityInvitation = (invitationId: string, accept: boolean) =>
  apiRequest(`/community-invitations/${invitationId}/${accept ? 'accept' : 'reject'}`, {
    method: 'POST',
  });
export const getCommunityBans = (communityId: string) =>
  apiRequest<ApiCollection<CommunityBanView>>(`/communities/${communityId}/bans?limit=50`);
export const banCommunityMember = (
  communityId: string,
  userId: string,
  input: { reason?: string; expiresAt?: string },
) =>
  apiRequest<CommunityBanView>(`/communities/${communityId}/bans`, {
    method: 'POST',
    body: JSON.stringify({ userId, ...input }),
  });
export const unbanCommunityMember = (communityId: string, userId: string) =>
  apiRequest<CommunityBanView>(`/communities/${communityId}/bans/${userId}`, { method: 'DELETE' });
export const getCommunityReports = (communityId: string) =>
  apiRequest<ApiCollection<CommunityReportView>>(`/communities/${communityId}/reports?limit=50`);
export const createCommunityReport = (
  communityId: string,
  input: { targetType: 'POST' | 'COMMENT' | 'MEMBER'; targetId: string; reason: string },
) =>
  apiRequest<CommunityReportView>(`/communities/${communityId}/reports`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const reviewCommunityReport = (
  communityId: string,
  reportId: string,
  input: { status: 'RESOLVED' | 'DISMISSED'; resolution?: string },
) =>
  apiRequest<CommunityReportView>(`/communities/${communityId}/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const getDiscussions = (communityId: string) =>
  apiRequest<ApiCollection<DiscussionView>>(`/communities/${communityId}/discussions?limit=20`);

export const getActiveDiscussions = () =>
  apiRequest<ApiCollection<DiscussionView>>('/discussions?limit=10');

export const createDiscussion = (
  communityId: string,
  input: {
    title: string;
    content: string;
    type: 'QUESTION' | 'DISCUSSION' | 'RESOURCE';
    tags: string[];
  },
) =>
  apiRequest<DiscussionView>(`/communities/${communityId}/discussions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getDiscussion = (id: string) => apiRequest<DiscussionView>(`/discussions/${id}`);

export const getReplies = (id: string) =>
  apiRequest<ApiCollection<ReplyView>>(`/discussions/${id}/replies?limit=50`);

export const createReply = (id: string, content: string) =>
  apiRequest<ReplyView>(`/discussions/${id}/replies`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
