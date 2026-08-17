import { describe, expect, it } from 'vitest';
import { settingsUpdate } from '../../src/modules/settings/interfaces/settings.schemas';

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
});
