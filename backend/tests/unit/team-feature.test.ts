import { describe, expect, it } from 'vitest';
import {
  teamCreate,
  teamJoinRequestCreate,
  teamListQuery,
  teamOwnershipTransfer,
  teamRoleUpdate,
  invitationCreate,
} from '../../src/modules/collaboration/interfaces/collaboration.schemas';

describe('team feature boundaries', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('accepts the canonical team creation fields', () => {
    const result = teamCreate.safeParse({
      name: 'Campus Builders',
      description: 'A team building a campus app.',
      goal: 'Ship the first working release.',
      category: 'Project',
      tags: ['React', 'MongoDB'],
      lookingFor: ['Designer'],
      visibility: 'PUBLIC',
      maxMembers: 8,
    });
    expect(result.success).toBe(true);
  });

  it('requires a team goal and category', () => {
    expect(
      teamCreate.safeParse({
        name: 'Incomplete team',
        description: 'Missing required planning fields.',
        visibility: 'PUBLIC',
      }).success,
    ).toBe(false);
  });

  it('accepts discovery filters and membership-management boundaries', () => {
    expect(
      teamListQuery.safeParse({ limit: '20', search: 'React', available: 'true' }).success,
    ).toBe(true);
    expect(teamJoinRequestCreate.safeParse({ message: 'I can help with the API.' }).success).toBe(
      true,
    );
    expect(teamRoleUpdate.safeParse({ role: 'CO_LEAD' }).success).toBe(true);
    expect(teamOwnershipTransfer.safeParse({ userId }).success).toBe(true);
  });

  it('rejects legacy team role values at the API boundary', () => {
    expect(teamRoleUpdate.safeParse({ role: 'ADMIN' }).success).toBe(false);
  });

  it('requires an internal user ObjectId for team invitations', () => {
    expect(invitationCreate.safeParse({ inviteeId: userId }).success).toBe(true);
    expect(invitationCreate.safeParse({ inviteeId: 'virat18' }).success).toBe(false);
  });
});
