export const CONVERSATION_TYPES = ['DIRECT', 'GROUP', 'TEAM', 'COMMUNITY'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];
export const CONVERSATION_STATUSES = ['ACTIVE', 'ARCHIVED', 'DISABLED'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export const MESSAGE_TYPES = ['TEXT', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type ConversationMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type ConversationMemberStatus = 'ACTIVE' | 'LEFT' | 'REMOVED';
export type NotificationPreference = 'ALL' | 'MENTIONS' | 'NONE';
export type MessageStatus = 'ACTIVE' | 'DELETED';

export interface ConversationParticipantView {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface ConversationView {
  id: string;
  type: ConversationType;
  title?: string;
  createdBy: string;
  teamId?: string;
  communityId?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  lastMessagePreview?: string;
  peer?: ConversationParticipantView;
  unreadCount?: number;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMemberView {
  id: string;
  conversationId: string;
  userId: string;
  role: ConversationMemberRole;
  status: ConversationMemberStatus;
  joinedAt: string;
  leftAt?: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
  notificationPreference: NotificationPreference;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyToMessageId?: string;
}

export interface MessageSendPayload {
  conversationId: string;
  clientMessageId: string;
  content: string;
  messageType?: MessageType;
  replyToMessageId?: string;
}
export interface MessageAcknowledgement {
  clientMessageId: string;
  messageId?: string;
  status: 'persisted' | 'duplicate' | 'failed';
  serverTimestamp?: string;
  error?: { code: string; message: string };
}
export interface ReadState {
  conversationId: string;
  lastReadMessageId?: string;
  lastReadAt?: string;
}
export type PresenceState = 'online' | 'offline';
export interface PresenceUpdate {
  userId: string;
  state: PresenceState;
  updatedAt: string;
}
export interface TypingUpdate {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  expiresAt?: string;
}
export interface SocketErrorPayload {
  code: string;
  message: string;
  requestId: string;
}

export interface RealtimeEventPayloadMap {
  'connection:ready': { socketId: string; userId: string; serverTime: string };
  'conversation:joined': { conversationId: string };
  'conversation:left': { conversationId: string };
  'message:new': MessageView;
  'message:updated': MessageView;
  'message:deleted': MessageView;
  'message:ack': MessageAcknowledgement;
  'message:read': ReadState & { userId: string };
  'typing:update': TypingUpdate;
  'presence:update': PresenceUpdate;
}

export type RealtimeEventName = keyof RealtimeEventPayloadMap;
