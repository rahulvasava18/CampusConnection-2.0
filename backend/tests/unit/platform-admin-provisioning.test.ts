import { describe, expect, it, vi } from 'vitest';
import {
  provisionPlatformAdmin,
  PlatformAdminProvisioningError,
} from '../../scripts/create-platform-admin';
import { verifyPassword } from '../../src/modules/identity/security/password.service';

describe('platform admin provisioning', () => {
  it('creates an active verified platform admin with a compatible password hash', async () => {
    const created: Record<string, unknown>[] = [];
    const model = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
        created.push(input);
        return input;
      }),
    };

    const result = await provisionPlatformAdmin(
      {
        email: ' Admin@CampusConnection.test ',
        username: ' CampusAdmin ',
        password: 'Strong-admin-password-1',
      },
      model as never,
    );

    expect(result).toEqual({
      status: 'created',
      email: 'admin@campusconnection.test',
      username: 'campusadmin',
      role: 'PLATFORM_ADMIN',
    });
    expect(created[0]).toMatchObject({
      email: 'admin@campusconnection.test',
      username: 'campusadmin',
      accountState: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      roles: ['PLATFORM_ADMIN'],
    });
    expect(created[0]?.passwordHash).toEqual(expect.any(String));
    expect(created[0]?.passwordHash).not.toBe('Strong-admin-password-1');
    expect(await verifyPassword('Strong-admin-password-1', created[0]?.passwordHash as string)).toBe(
      true,
    );
  });

  it('is idempotent for an existing email without creating a duplicate', async () => {
    const model = {
      findOne: vi.fn().mockResolvedValue({ id: 'existing-user' }),
      create: vi.fn(),
    };

    const result = await provisionPlatformAdmin(
      { email: 'admin@example.com', username: 'campusadmin', password: 'Strong-password-1' },
      model as never,
    );

    expect(result.status).toBe('already_exists');
    expect(model.create).not.toHaveBeenCalled();
  });

  it('stops when another platform admin already exists', async () => {
    const model = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-admin', roles: ['PLATFORM_ADMIN'] }),
      create: vi.fn(),
    };

    await expect(
      provisionPlatformAdmin(
        { email: 'new-admin@example.com', username: 'campusadmin', password: 'Strong-password-1' },
        model as never,
      ),
    ).rejects.toThrow(PlatformAdminProvisioningError);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('requires all provisioning credentials', async () => {
    const model = { findOne: vi.fn(), create: vi.fn() };

    await expect(
      provisionPlatformAdmin(
        { email: '', username: 'campusadmin', password: 'Strong-password-1' },
        model as never,
      ),
    ).rejects.toThrow('PLATFORM_ADMIN_EMAIL is required.');
    await expect(
      provisionPlatformAdmin(
        { email: 'admin@example.com', username: '', password: 'Strong-password-1' },
        model as never,
      ),
    ).rejects.toThrow('PLATFORM_ADMIN_USERNAME is required.');
    await expect(
      provisionPlatformAdmin(
        { email: 'admin@example.com', username: 'campusadmin', password: '' },
        model as never,
      ),
    ).rejects.toThrow('PLATFORM_ADMIN_PASSWORD is required.');
  });
});
