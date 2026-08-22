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

export const passwordUpdate = z
  .object({
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword)
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  });

export const passwordRecoveryUpdate = z
  .object({
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword)
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  });
