import { describe, expect, it } from 'vitest';
import {
  profileIdParams,
  profileQuery,
} from '../../src/modules/profile/interfaces/profile.schemas';

describe('profile API validation', () => {
  it('accepts a valid profile id and cursor pagination', () => {
    const result = profileQuery.safeParse({ limit: '12', cursor: 'profile-cursor' });
    expect(result.success).toBe(true);
    expect(profileIdParams.safeParse({ userId: '507f1f77bcf86cd799439011' }).success).toBe(true);
  });

  it('rejects malformed ids, oversized pages, and unknown fields', () => {
    expect(profileIdParams.safeParse({ userId: 'not-an-object-id' }).success).toBe(false);
    expect(profileQuery.safeParse({ limit: '21' }).success).toBe(false);
    expect(profileQuery.safeParse({ limit: '12', unexpected: true }).success).toBe(false);
  });
});
