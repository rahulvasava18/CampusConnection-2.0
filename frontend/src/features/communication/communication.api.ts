import type {
  ApiCollection,
  ConversationMemberView,
  ConversationView,
  MessageView,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function getConversations(cursor?: string) {
  const query = new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) });
  return apiRequest<ApiCollection<ConversationView>>(`/conversations?${query.toString()}`);
}
export function getConversationMembers(conversationId: string) {
  return apiRequest<ApiCollection<ConversationMemberView>>(
    `/conversations/${conversationId}/members`,
  );
}
export function getMessages(conversationId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: '50', ...(cursor ? { cursor } : {}) });
  return apiRequest<ApiCollection<MessageView>>(
    `/conversations/${conversationId}/messages?${query.toString()}`,
  );
}
export function createDirectConversation(targetUserId: string) {
  return apiRequest<ConversationView>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ type: 'DIRECT', targetUserId }),
  });
}
export function createCommunityConversation(communityId: string) {
  return apiRequest<ConversationView>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ type: 'COMMUNITY', communityId, title: '# general' }),
  });
}
export function createTeamConversation(teamId: string) {
  return apiRequest<ConversationView>('/conversations', {
    method: 'POST',
    body: JSON.stringify({ type: 'TEAM', teamId, title: '# general' }),
  });
}
export function markConversationRead(conversationId: string, messageId: string) {
  return apiRequest(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ messageId }),
  });
}

export function editMessage(messageId: string, content: string) {
  return apiRequest<MessageView>(`/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export function deleteMessage(messageId: string) {
  return apiRequest<void>(`/messages/${messageId}`, { method: 'DELETE' });
}
