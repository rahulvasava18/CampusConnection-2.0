import { describe, expect, it } from 'vitest';
import {
  conversationCreate,
  messageCreate,
} from '../../src/modules/communication/interfaces/communication.schemas';
import { conversationPresenceKey } from '../../src/modules/communication/realtime/presence';

describe('communication feature boundaries', () => {
  const userId = '507f1f77bcf86cd799439011';
  const conversationId = '507f1f77bcf86cd799439012';

  it('accepts direct conversations with a target user and rejects malformed identifiers', () => {
    const result = conversationCreate.safeParse({ type: 'DIRECT', targetUserId: userId });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ type: 'DIRECT', targetUserId: userId });
    }
    expect(
      conversationCreate.safeParse({ type: 'DIRECT', targetUserId: 'not-an-id' }).success,
    ).toBe(false);
    expect(conversationCreate.safeParse({ type: 'DIRECT', participantId: userId }).success).toBe(
      false,
    );
  });

  it('accepts text messages and applies the text message default', () => {
    const result = messageCreate.safeParse({
      conversationId,
      clientMessageId: 'client-message-001',
      content: 'Hello from CampusConnection',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.messageType).toBe('TEXT');
  });

  it('rejects empty message content and unknown message fields', () => {
    expect(
      messageCreate.safeParse({
        conversationId,
        clientMessageId: 'client-message-001',
        content: '',
      }).success,
    ).toBe(false);
    expect(
      messageCreate.safeParse({
        conversationId,
        clientMessageId: 'client-message-001',
        content: 'hello',
        senderId: userId,
      }).success,
    ).toBe(false);
  });

  it('uses a scoped Redis key for active conversation viewing state', () => {
    expect(conversationPresenceKey(conversationId, userId)).toBe(
      `presence:conversation:${conversationId}:${userId}`,
    );
  });
});
