import { z } from 'zod';

const notificationPreferences = z
  .object({
    messages: z.boolean().optional(),
    teamActivity: z.boolean().optional(),
    projectActivity: z.boolean().optional(),
    communityActivity: z.boolean().optional(),
    eventUpdates: z.boolean().optional(),
    socialInteractions: z.boolean().optional(),
  })
  .strict();

const privacyPreferences = z
  .object({
    profileDiscoverable: z.boolean().optional(),
    showInRecommendations: z.boolean().optional(),
  })
  .strict();

export const settingsUpdate = z
  .object({
    preferences: z
      .object({
        notifications: notificationPreferences.optional(),
        privacy: privacyPreferences.optional(),
      })
      .strict(),
  })
  .strict();
