import { describe, expect, it } from 'vitest';
import { PendingSignupModel } from '../../src/modules/identity/infrastructure/pending-signup.model';

describe('pending signup persistence contract', () => {
  it('stores signup credentials without a User reference', () => {
    const paths = PendingSignupModel.schema.paths;
    expect(paths.userId).toBeUndefined();
    expect(paths.displayName).toBeDefined();
    expect(paths.usernameNormalized).toBeDefined();
    expect(paths.emailNormalized).toBeDefined();
    expect(paths.passwordHash?.options.select).toBe(false);
    expect(paths.verificationTokenHash?.options.select).toBe(false);
  });

  it('expires abandoned signups using the verification expiry index', () => {
    expect(PendingSignupModel.schema.indexes()).toContainEqual([
      { expiresAt: 1 },
      { background: true, expireAfterSeconds: 0 },
    ]);
  });
});
