import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { CollaborationService } from '../../src/modules/collaboration/application/collaboration.service';
import { AppError } from '../../src/shared/errors/app-error';
import type { CommunityRepository } from '../../src/modules/collaboration/infrastructure/collaboration.repositories';
import type { CommunityDocument } from '../../src/modules/collaboration/infrastructure/collaboration.models';
import type { UserRepository } from '../../src/modules/identity/infrastructure/identity.repositories';
import type { UserDocument } from '../../src/modules/identity/infrastructure/user.model';

const communityId = '507f1f77bcf86cd799439011';
const actorId = '507f1f77bcf86cd799439012';
const inviteeId = '507f1f77bcf86cd799439013';

function createInvitationService(options: {
  actorRole?: 'ADMIN' | 'MEMBER';
  inviteeExists?: boolean;
  inviteeMember?: boolean;
  pendingInvitation?: boolean;
} = {}) {
  const community = {
    id: communityId,
    ownerId: new Types.ObjectId(actorId),
    status: 'ACTIVE',
    privacy: 'PRIVATE',
  } as unknown as CommunityDocument;
  const activeUser = { accountState: 'ACTIVE' } as unknown as UserDocument;
  const communities = {
    findById: vi.fn(async () => community),
    findMember: vi.fn(async (_id: string, userId: string) => {
      if (userId === actorId)
        return { status: 'ACTIVE', role: options.actorRole ?? 'ADMIN' } as never;
      if (options.inviteeMember) return { status: 'ACTIVE', role: 'MEMBER' } as never;
      return null;
    }),
    findActiveBan: vi.fn(async () => null),
    findPendingInvitation: vi.fn(async () => (options.pendingInvitation ? ({} as never) : null)),
  } as unknown as CommunityRepository;
  const users = {
    findById: vi.fn(async (userId: string) => {
      if (userId === inviteeId && options.inviteeExists === false) return null;
      return activeUser;
    }),
  } as unknown as UserRepository;

  return new CollaborationService({ communities, users });
}

async function expectInvitationError(
  service: CollaborationService,
  expectedCode: string,
  targetId = inviteeId,
) {
  try {
    await service.inviteCommunityMember(
      { userId: actorId, accountState: 'ACTIVE', roles: [] },
      communityId,
      targetId,
      'community-invitation-test',
    );
    throw new Error('Expected invitation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(expectedCode);
  }
}

describe('community invitation safeguards', () => {
  it('rejects a nonexistent user', async () => {
    await expectInvitationError(
      createInvitationService({ inviteeExists: false }),
      'RESOURCE_NOT_FOUND',
    );
  });

  it('rejects an existing member', async () => {
    await expectInvitationError(
      createInvitationService({ inviteeMember: true }),
      'MEMBERSHIP_EXISTS',
    );
  });

  it('rejects a duplicate pending invitation', async () => {
    await expectInvitationError(
      createInvitationService({ pendingInvitation: true }),
      'INVITATION_EXISTS',
    );
  });

  it('rejects a self invitation through the existing membership guard', async () => {
    await expectInvitationError(
      createInvitationService({ inviteeMember: true }),
      'MEMBERSHIP_EXISTS',
      actorId,
    );
  });

  it('rejects an unauthorized community member', async () => {
    await expectInvitationError(
      createInvitationService({ actorRole: 'MEMBER' }),
      'FORBIDDEN',
    );
  });
});
