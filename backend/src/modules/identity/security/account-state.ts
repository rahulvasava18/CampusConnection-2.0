import type { UserDocument } from '../infrastructure/user.model';

/**
 * Suspensions are enforced by the backend, including when a user keeps an old
 * access token. Once an expiry is reached, the first authenticated request
 * restores the account to ACTIVE; the frontend never controls this transition.
 */
export async function normalizeExpiredSuspension(user: UserDocument): Promise<UserDocument> {
  if (
    user.accountState !== 'SUSPENDED' ||
    !user.suspendedUntil ||
    user.suspendedUntil.getTime() > Date.now()
  )
    return user;

  user.accountState = 'ACTIVE';
  delete user.suspendedAt;
  delete user.suspendedUntil;
  delete user.suspensionReason;
  await user.save();
  return user;
}
