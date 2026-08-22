import { describe, expect, it, vi } from 'vitest';
import {
  provisionPlatformAdmin,
  PlatformAdminProvisioningError,
  validatePlatformAdminCredentials,
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

  it('stops when the requested username already exists', async () => {
    const model = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user', username: 'campusadmin' }),
      create: vi.fn(),
    };

    await expect(
      provisionPlatformAdmin(
        { email: 'new-admin@example.com', username: 'campusadmin', password: 'Strong-password-1' },
        model as never,
      ),
    ).rejects.toThrow('username is already in use');
    expect(model.create).not.toHaveBeenCalled();
  });

  it('reports safe field-level validation issues without the password', () => {
    let error: unknown;
    try {
      validatePlatformAdminCredentials('not-an-email', 'campusadmin', 'Strong-password-1');
    } catch (caught) {
      error = caught;
    }

    expect(error instanceof Error ? error.message : '').toContain('email: Invalid email address');

    error = undefined;
    try {
      validatePlatformAdminCredentials('admin@example.com', 'bad username', 'Strong-password-1');
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error ? error.message : '').toContain(
      'username: Username can contain only letters, numbers, and underscores',
    );

    error = undefined;
    try {
      validatePlatformAdminCredentials('admin@example.com', 'campusadmin', 'short');
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof Error ? error.message : '').toContain('password: Too small');

    error = undefined;
    try {
      validatePlatformAdminCredentials('admin@example.com', 'campusadmin', 'secret-password-value');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeUndefined();
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
