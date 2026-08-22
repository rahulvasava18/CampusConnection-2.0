import { describe, expect, it } from 'vitest';
import {
  banCreate,
  communityCreate,
  discussionCreate,
  invitationCreate,
  joinRequestIdParams,
  ownershipTransfer,
  replyCreate,
  reportCreate,
} from '../../src/modules/collaboration/interfaces/collaboration.schemas';

describe('community feature boundaries', () => {
  it('accepts a valid community payload', () => {
    const result = communityCreate.safeParse({
      name: 'Frontend Builders',
      slug: 'frontend-builders',
      description: 'A space for frontend conversations.',
      category: 'Technology',
      privacy: 'PUBLIC',
    });
    expect(result.success).toBe(true);
  });

  it('accepts lightweight creation without advanced metadata', () => {
    const result = communityCreate.safeParse({
      name: 'Campus Builders',
      category: 'Technology',
      privacy: 'PRIVATE',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('');
      expect(result.data.tags).toEqual([]);
      expect(result.data.rules).toEqual([]);
    }
  });

  it('rejects empty discussion and reply content', () => {
    expect(
      discussionCreate.safeParse({ title: '', content: '', type: 'DISCUSSION', tags: [] }).success,
    ).toBe(false);
    expect(replyCreate.safeParse({ content: '' }).success).toBe(false);
  });

  it('rejects unknown community fields', () => {
    expect(
      communityCreate.safeParse({
        name: 'Builders',
        slug: 'builders',
        description: 'A valid description.',
        category: 'Technology',
        privacy: 'PUBLIC',
        members: [],
      }).success,
    ).toBe(false);
  });

  it('accepts the community membership and moderation boundaries', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(joinRequestIdParams.safeParse({ communityId: id, requestId: id }).success).toBe(true);
    expect(ownershipTransfer.safeParse({ userId: id }).success).toBe(true);
    expect(banCreate.safeParse({ userId: id }).success).toBe(true);
    expect(
      reportCreate.safeParse({ targetType: 'POST', targetId: id, reason: 'Off topic' }).success,
    ).toBe(true);
  });

  it('requires the internal user identifier for community invitations', () => {
    expect(
      invitationCreate.safeParse({ inviteeId: '507f1f77bcf86cd799439011' }).success,
    ).toBe(true);
    expect(invitationCreate.safeParse({ inviteeId: 'virat_18' }).success).toBe(false);
  });
});
