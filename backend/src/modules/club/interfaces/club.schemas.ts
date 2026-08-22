import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
const date = z.string().datetime({ offset: true });
export const clubIdParams = z.object({ clubId: objectId }).strict();
export const clubMemberParams = z.object({ clubId: objectId, userId: objectId }).strict();
export const clubRequestParams = z.object({ clubId: objectId, requestId: objectId }).strict();
export const clubInvitationParams = z.object({ invitationId: objectId }).strict();
export const clubListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(1000).optional(),
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED']).optional(),
}).strict();
export const clubCreate = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(3).max(90).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().min(1).max(3000),
  category: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  logoUrl: z.string().url().max(500).optional(),
  bannerUrl: z.string().url().max(500).optional(),
  collegeId: z.string().trim().max(120).optional(),
  contactEmail: z.string().email().max(254),
  website: z.string().url().max(500).optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']),
}).strict();
export const clubUpdate = clubCreate.omit({ slug: true }).partial().strict();
export const clubJoin = z.object({ message: z.string().trim().max(500).optional() }).strict();
export const clubRole = z.object({ role: z.enum(['SECRETARY', 'MEMBER']) }).strict();
export const clubInvite = z.object({ inviteeId: objectId }).strict();
export const clubEventCreate = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  coverImageUrl: z.string().url().max(500).optional(),
  venue: z.string().trim().max(300).optional(),
  mode: z.enum(['OFFLINE', 'ONLINE', 'HYBRID']),
  meetingLink: z.string().url().max(500).optional(),
  startAt: date,
  endAt: date,
  registrationDeadline: date.optional(),
  registrationUrl: z.string().url().max(500).optional(),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  registrationRequired: z.boolean().default(true),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  rules: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.endAt <= value.startAt) ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'End time must be after the start time.' });
  if (value.registrationRequired && !value.registrationUrl) ctx.addIssue({ code: 'custom', path: ['registrationUrl'], message: 'Registration URL is required when registration is enabled.' });
  if (value.registrationDeadline && value.registrationDeadline >= value.startAt) ctx.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'Registration must close before the event starts.' });
});
export const adminClubStatus = z.object({ status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED']), reason: z.string().trim().max(500).optional() }).strict();
