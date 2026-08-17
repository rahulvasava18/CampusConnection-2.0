import { describe, expect, it } from 'vitest';
import {
  createOpaqueToken,
  hashOpaqueToken,
} from '../../src/modules/identity/security/token.service';
import {
  signAccessToken,
  verifyAccessToken,
} from '../../src/modules/identity/security/jwt.service';
import { canAuthorize } from '../../src/modules/identity/security/authorization.policy';
import type { AuthContext } from '../../src/modules/identity/interfaces/auth.types';

describe('identity security primitives', () => {
  it('hashes opaque refresh tokens without storing the raw value', () => {
    const token = createOpaqueToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashOpaqueToken(token)).not.toBe(token);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it('signs and verifies minimal asymmetric access-token claims', () => {
    const token = signAccessToken({
      sub: '507f1f77bcf86cd799439011',
      sid: 'session',
      fid: 'family',
      roles: ['STUDENT'],
    });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe('507f1f77bcf86cd799439011');
    expect(claims.roles).toEqual(['STUDENT']);
    expect(() => verifyAccessToken(`${token}tampered`)).toThrow();
  });

  it('allows owner authorization and platform-admin bypass centrally', async () => {
    const base = {
      userId: 'user-1',
      sessionId: 'session',
      familyId: 'family',
      user: { accountState: 'ACTIVE' },
    } as AuthContext;
    await expect(
      canAuthorize({ ...base, roles: ['STUDENT'] }, { ownerId: 'user-1' }),
    ).resolves.toBe(true);
    await expect(
      canAuthorize({ ...base, roles: ['STUDENT'] }, { ownerId: 'user-2' }),
    ).resolves.toBe(false);
    await expect(
      canAuthorize({ ...base, roles: ['PLATFORM_ADMIN'] }, { ownerId: 'user-2' }),
    ).resolves.toBe(true);
  });
});
