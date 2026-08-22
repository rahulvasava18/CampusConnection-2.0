import type { ApiCollection, ClubInvitationView, ClubJoinRequestView, ClubMembershipView, ClubView, EventView } from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export const getClubs = (params: { search?: string; category?: string; privacy?: string } = {}) => {
  const query = new URLSearchParams({ limit: '30' });
  Object.entries(params).forEach(([key, value]) => { if (value && value !== 'All') query.set(key, value); });
  return apiRequest<ApiCollection<ClubView>>(`/clubs?${query.toString()}`);
};
export const getMyClubs = () => apiRequest<ApiCollection<ClubView>>('/clubs/mine');
export const getClub = (id: string) => apiRequest<ClubView>(`/clubs/${id}`);
export const createClub = (input: Record<string, unknown>) => apiRequest<ClubView>('/clubs', { method: 'POST', body: JSON.stringify(input) });
export const updateClub = (id: string, input: Record<string, unknown>) => apiRequest<ClubView>(`/clubs/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
export const joinClub = (id: string, message?: string) => apiRequest(`/clubs/${id}/join`, { method: 'POST', body: JSON.stringify(message ? { message } : {}) });
export const getClubMembers = (id: string) => apiRequest<ApiCollection<ClubMembershipView>>(`/clubs/${id}/members`);
export const getClubRequests = (id: string) => apiRequest<ApiCollection<ClubJoinRequestView>>(`/clubs/${id}/requests`);
export const reviewClubRequest = (clubId: string, requestId: string, approve: boolean) => apiRequest(`/clubs/${clubId}/requests/${requestId}/${approve ? 'approve' : 'reject'}`, { method: 'POST' });
export const updateClubMemberRole = (clubId: string, userId: string, role: 'SECRETARY' | 'MEMBER') => apiRequest<ClubMembershipView>(`/clubs/${clubId}/members/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const removeClubMember = (clubId: string, userId: string) => apiRequest<void>(`/clubs/${clubId}/members/${userId}`, { method: 'DELETE' });
export const getClubInvitations = () => apiRequest<ApiCollection<ClubInvitationView>>('/club-invitations');
export const inviteClubMember = (clubId: string, inviteeId: string) => apiRequest<ClubInvitationView>(`/clubs/${clubId}/invitations`, { method: 'POST', body: JSON.stringify({ inviteeId }) });
export const respondToClubInvitation = (id: string, accept: boolean) => apiRequest<ClubInvitationView>(`/club-invitations/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
export const getClubEvents = (id: string) => apiRequest<ApiCollection<EventView>>(`/clubs/${id}/events`);
export const createClubEvent = (id: string, input: Record<string, unknown>) => apiRequest<EventView>(`/clubs/${id}/events`, { method: 'POST', body: JSON.stringify(input) });
