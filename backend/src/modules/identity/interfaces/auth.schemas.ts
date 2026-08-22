import { z } from 'zod';

const listField = z.array(z.string().trim().min(1).max(80)).max(50).default([]);

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can contain only letters, numbers, and underscores.');

const emailSchema = z.string().trim().email().max(254);

export const signupSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    username: usernameSchema,
    email: emailSchema,
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginSchema = z
  .object({ identifier: z.string().trim().min(1).max(254), password: z.string().min(1).max(128) })
  .strict();

export const verifyEmailSchema = z.object({ token: z.string().trim().min(32).max(512) }).strict();

export const resendVerificationSchema = z
  .object({ identifier: z.string().trim().min(1).max(254) })
  .strict();

export const googleExchangeSchema = z.object({ code: z.string().trim().min(32).max(512) }).strict();

export const googlePasswordRecoveryExchangeSchema = googleExchangeSchema;

export const googleOnboardingSchema = z
  .object({
    onboardingToken: z.string().trim().min(32).max(512),
    displayName: z.string().trim().min(1).max(100),
    username: usernameSchema,
  })
  .strict();

export const googleUsernameAvailabilitySchema = z
  .object({ onboardingToken: z.string().trim().min(32).max(512), username: usernameSchema })
  .strict();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().max(500).optional(),
    college: z.string().trim().max(160).optional(),
    department: z.string().trim().max(160).optional(),
    course: z.string().trim().max(160).optional(),
    graduationYear: z.coerce.number().int().min(1900).max(2200).optional(),
    skills: listField.optional(),
    interests: listField.optional(),
    goals: listField.optional(),
    avatarUrl: z.string().url().max(500).optional(),
  })
  .strict();
export const sessionParamsSchema = z
  .object({ sessionId: z.string().regex(/^[a-f0-9]{24}$/i) })
  .strict();
