import { describe, expect, it } from 'vitest';
import {
  normalizeEmail,
  normalizeIdentifier,
  normalizeUsername,
} from '../../src/modules/identity/security/credential-normalization';
import { hashPassword, verifyPassword } from '../../src/modules/identity/security/password.service';
import { AuthService } from '../../src/modules/identity/application/auth.service';

describe('password authentication primitives', () => {
  it('normalizes email, username, and login identifiers', () => {
    expect(normalizeEmail(' Rahul@Example.COM ')).toBe('rahul@example.com');
    expect(normalizeUsername(' Rahul16 ')).toBe('rahul16');
    expect(normalizeIdentifier(' Rahul16 ')).toBe('rahul16');
    expect(normalizeIdentifier(' Rahul@Example.COM ')).toBe('rahul@example.com');
  });

  it('hashes passwords without storing or returning plaintext', async () => {
    const password = 'a-secure-password';
    const encoded = await hashPassword(password);
    expect(encoded).not.toContain(password);
    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword('wrong-password', encoded)).toBe(false);
  });

  it('returns PASSWORD_NOT_SET for a Google-only account without verifying a fake password', async () => {
    const service = new AuthService({
      users: {
        findByIdentifier: async () => ({ passwordHash: undefined }),
      } as never,
      rateLimiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 1 }) } as never,
    });

    await expect(
      service.login('student@example.com', 'any-password', { correlationId: 'correlation-1' }),
    ).rejects.toMatchObject({
      code: 'PASSWORD_NOT_SET',
      statusCode: 403,
    });
  });
});
