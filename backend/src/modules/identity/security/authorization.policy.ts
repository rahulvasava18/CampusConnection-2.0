import type { PlatformRole } from '@campusconnection/shared';
import type { AuthContext } from '../interfaces/auth.types';
import { RoleAssignmentModel } from '../infrastructure/role-assignment.model';

export interface AuthorizationRequirement {
  roles?: PlatformRole[];
  scopeType?: string;
  scopeId?: string;
  ownerId?: string;
  accountStates?: string[];
}

export async function canAuthorize(
  actor: AuthContext,
  requirement: AuthorizationRequirement,
): Promise<boolean> {
  if (requirement.accountStates && !requirement.accountStates.includes(actor.user.accountState))
    return false;
  if (
    requirement.ownerId &&
    requirement.ownerId !== actor.userId &&
    !actor.roles.includes('PLATFORM_ADMIN')
  )
    return false;
  if (!requirement.roles?.length) return true;
  if (actor.roles.includes('PLATFORM_ADMIN')) return true;
  const globalMatch = requirement.roles.some((role) => actor.roles.includes(role));
  if (globalMatch && !requirement.scopeType) return true;
  if (!requirement.scopeType || !requirement.scopeId) return false;
  const assignment = await RoleAssignmentModel.findOne({
    userId: actor.userId,
    role: { $in: requirement.roles },
    scopeType: requirement.scopeType,
    scopeId: requirement.scopeId,
  })
    .lean()
    .exec();
  return Boolean(assignment);
}
