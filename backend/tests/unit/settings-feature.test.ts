import { describe, expect, it } from 'vitest';
import {
  passwordRecoveryUpdate,
  settingsUpdate,
} from '../../src/modules/settings/interfaces/settings.schemas';

describe('settings validation', () => {
  it('accepts supported privacy and notification preferences', () => {
    const result = settingsUpdate.safeParse({
      preferences: {
        privacy: { profileDiscoverable: false },
        notifications: { messages: false, eventUpdates: true },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown preference fields and invalid values', () => {
    expect(
      settingsUpdate.safeParse({
        preferences: { privacy: { profileDiscoverable: 'yes' } },
      }).success,
    ).toBe(false);
    expect(
      settingsUpdate.safeParse({
        preferences: { notifications: { email: true } },
      }).success,
    ).toBe(false);
  });

  it('requires matching strong passwords for Google recovery without accepting a current password', () => {
    expect(
      passwordRecoveryUpdate.safeParse({
        newPassword: 'new-secure-password',
        confirmPassword: 'new-secure-password',
      }).success,
    ).toBe(true);
    expect(
      passwordRecoveryUpdate.safeParse({
        currentPassword: 'old-password',
        newPassword: 'new-secure-password',
        confirmPassword: 'new-secure-password',
      }).success,
    ).toBe(false);
    expect(
      passwordRecoveryUpdate.safeParse({
        newPassword: 'new-secure-password',
        confirmPassword: 'different-password',
      }).success,
    ).toBe(false);
  });
});
