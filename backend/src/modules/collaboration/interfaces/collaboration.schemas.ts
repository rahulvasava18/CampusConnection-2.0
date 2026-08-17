import { z } from 'zod';
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Expected a MongoDB identifier.');
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(90)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z.string().datetime({ offset: true }).optional();
const requiredDate = z.string().datetime({ offset: true });
export const idParams = (name: string) =>
  z
    .object({})
    .extend({ [name]: objectId })
    .strict();
export const paginationQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(1000).optional(),
  })
  .strict();
export const communityListQuery = paginationQuery
  .extend({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    tags: z.string().trim().max(200).optional(),
  })
  .strict();
export const communityCreate = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug,
    description: z.string().trim().min(1).max(1000),
    category: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    rules: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
    avatarUrl: z.string().url().max(500).optional(),
    bannerUrl: z.string().url().max(500).optional(),
    collegeId: z.string().trim().max(120).optional(),
    privacy: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  })
  .strict();
export const communityUpdate = communityCreate.omit({ slug: true }).partial().strict();
export const communityMemberUpdate = z
  .object({
    role: z.enum(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']).optional(),
    status: z.enum(['ACTIVE', 'PENDING', 'BANNED', 'LEFT']).optional(),
  })
  .strict()
  .refine((value) => value.role || value.status, 'A membership change is required.');
export const teamCreate = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(1).max(1500),
    goal: z.string().trim().min(1).max(1500),
    category: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    avatarUrl: z.string().url().max(500).optional(),
    deadline: date.optional(),
    lookingFor: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    communityId: objectId.optional(),
    projectId: objectId.optional(),
    maxMembers: z.coerce.number().int().min(1).max(100).optional(),
    visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  })
  .strict();
export const teamListQuery = paginationQuery
  .extend({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    tags: z.string().trim().max(200).optional(),
    available: z.coerce.boolean().optional(),
  })
  .strict();
export const teamUpdate = teamCreate
  .omit({ communityId: true, projectId: true })
  .partial()
  .extend({ status: z.enum(['RECRUITING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional() })
  .strict();
export const teamRequirementCreate = z
  .object({
    roleName: z.string().trim().min(1).max(120),
    skills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    interests: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    experienceLevel: z.string().trim().max(80).optional(),
    slots: z.coerce.number().int().min(1).max(100),
    description: z.string().trim().max(1000).default(''),
    priority: z.coerce.number().int().min(0).max(100).default(50),
  })
  .strict();
export const teamRequirementUpdate = teamRequirementCreate.partial().strict();
export const invitationCreate = z.object({ inviteeId: objectId }).strict();
export const ownershipTransfer = z.object({ userId: objectId }).strict();
export const joinRequestCreate = z
  .object({ message: z.string().trim().max(500).optional() })
  .strict();
export const invitationIdParams = z.object({ invitationId: objectId }).strict();
export const joinRequestIdParams = z
  .object({ communityId: objectId, requestId: objectId })
  .strict();
export const banCreate = z
  .object({ userId: objectId, reason: z.string().trim().max(500).optional(), expiresAt: date })
  .strict();
export const banUserParams = z.object({ communityId: objectId, userId: objectId }).strict();
export const reportCreate = z
  .object({
    targetType: z.enum(['POST', 'COMMENT', 'MEMBER']),
    targetId: objectId,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const reportParams = z.object({ communityId: objectId, reportId: objectId }).strict();
export const reportUpdate = z
  .object({
    status: z.enum(['RESOLVED', 'DISMISSED']),
    resolution: z.string().trim().max(500).optional(),
  })
  .strict();
export const projectCreate = z
  .object({
    name: z.string().trim().min(2).max(140),
    slug,
    description: z.string().trim().min(1).max(2500),
    objective: z.string().trim().min(1).max(1500),
    category: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    ownerTeamId: objectId.optional(),
    teamId: objectId.optional(),
    visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
    technologies: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    lookingFor: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    deadline: date,
    coverImageUrl: z.string().url().max(500).optional(),
    repositoryUrl: z.string().url().max(500).optional(),
    demoUrl: z.string().url().max(500).optional(),
  })
  .strict();
export const projectListQuery = paginationQuery
  .extend({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    tags: z.string().trim().max(200).optional(),
    status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED']).optional(),
  })
  .strict();
export const projectUpdate = projectCreate
  .omit({ slug: true, ownerTeamId: true, teamId: true })
  .partial()
  .strict();
export const projectMemberCreate = z.object({ userId: objectId }).strict();
export const projectJoinRequestCreate = z
  .object({ message: z.string().trim().max(500).optional() })
  .strict();
export const projectJoinRequestParams = z
  .object({ projectId: objectId, requestId: objectId })
  .strict();
export const projectOwnershipTransfer = z.object({ userId: objectId }).strict();
export const projectResourceCreate = z
  .object({
    title: z.string().trim().min(1).max(180),
    url: z.string().url().max(500),
    type: z.enum(['REPOSITORY', 'DEMO', 'DOCUMENTATION', 'DESIGN', 'OTHER']),
  })
  .strict();
export const projectResourceUpdate = projectResourceCreate.partial().strict();
export const projectResourceParams = z
  .object({ projectId: objectId, resourceId: objectId })
  .strict();
export const projectUpdateCreate = z
  .object({ message: z.string().trim().min(1).max(1000) })
  .strict();
export const taskCreate = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000).default(''),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    assigneeId: objectId.optional(),
    dueDate: date,
    status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  })
  .strict();
export const taskUpdate = taskCreate.partial().strict();
export const taskAssignment = z.object({ assigneeId: objectId }).strict();
export const taskStatus = z.object({ status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']) }).strict();
export const milestoneCreate = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000).default(''),
    dueDate: date,
    order: z.coerce.number().int().min(0).max(10000),
  })
  .strict();
export const milestoneUpdate = milestoneCreate
  .partial()
  .extend({ status: z.enum(['UPCOMING', 'IN_PROGRESS', 'COMPLETED']).optional() })
  .strict();
export const communityMemberParams = z.object({ communityId: objectId, userId: objectId }).strict();
export const discussionCreate = z
  .object({
    title: z.string().trim().min(2).max(180),
    content: z.string().trim().min(1).max(10000),
    type: z.enum(['QUESTION', 'DISCUSSION', 'RESOURCE']),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  })
  .strict();
export const replyCreate = z.object({ content: z.string().trim().min(1).max(5000) }).strict();
export const teamMemberParams = z.object({ teamId: objectId, userId: objectId }).strict();
export const teamJoinRequestCreate = z
  .object({ message: z.string().trim().max(500).optional() })
  .strict();
export const teamJoinRequestParams = z.object({ teamId: objectId, requestId: objectId }).strict();
export const teamRoleUpdate = z.object({ role: z.enum(['CO_LEAD', 'MEMBER']) }).strict();
export const teamOwnershipTransfer = z.object({ userId: objectId }).strict();
export const projectMemberParams = z.object({ projectId: objectId, userId: objectId }).strict();
export const projectInvitationCreate = z.object({ inviteeId: objectId }).strict();
const eventFields = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  coverImageUrl: z.string().url().max(500).optional(),
  venue: z.string().trim().max(300).optional(),
  mode: z.enum(['OFFLINE', 'ONLINE', 'HYBRID']),
  meetingLink: z.string().url().max(500).optional(),
  startAt: requiredDate,
  endAt: requiredDate,
  registrationDeadline: date,
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  registrationRequired: z.boolean().default(true),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  rules: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  teamId: objectId.optional(),
  communityId: objectId.optional(),
});
const validateEventTiming = (raw: unknown, ctx: z.RefinementCtx, enforceLocations = true) => {
  const value = raw as {
    mode?: 'OFFLINE' | 'ONLINE' | 'HYBRID';
    startAt?: string;
    endAt?: string;
    registrationDeadline?: string;
    venue?: string;
    meetingLink?: string;
  };
  if (
    value.startAt &&
    value.endAt &&
    new Date(value.endAt).valueOf() <= new Date(value.startAt).valueOf()
  )
    ctx.addIssue({
      code: 'custom',
      path: ['endAt'],
      message: 'End time must be after start time.',
    });
  if (
    value.startAt &&
    value.registrationDeadline &&
    new Date(value.registrationDeadline).valueOf() >= new Date(value.startAt).valueOf()
  )
    ctx.addIssue({
      code: 'custom',
      path: ['registrationDeadline'],
      message: 'Registration must close before the event starts.',
    });
  if (
    enforceLocations &&
    value.mode &&
    (value.mode === 'OFFLINE' || value.mode === 'HYBRID') &&
    !value.venue?.trim()
  )
    ctx.addIssue({
      code: 'custom',
      path: ['venue'],
      message: 'Venue is required for offline or hybrid events.',
    });
  if (
    enforceLocations &&
    value.mode &&
    (value.mode === 'ONLINE' || value.mode === 'HYBRID') &&
    !value.meetingLink?.trim()
  )
    ctx.addIssue({
      code: 'custom',
      path: ['meetingLink'],
      message: 'Meeting link is required for online or hybrid events.',
    });
};
export const eventCreate = eventFields
  .superRefine((value, ctx) => validateEventTiming(value, ctx))
  .strict();
export const eventUpdate = eventFields
  .partial()
  .superRefine((value, ctx) => validateEventTiming(value, ctx, false))
  .strict();
export const eventListQuery = paginationQuery
  .extend({
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(80).optional(),
    tags: z.string().trim().max(200).optional(),
    status: z.enum(['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED']).optional(),
    mode: z.enum(['OFFLINE', 'ONLINE', 'HYBRID']).optional(),
    from: date,
    to: date,
    available: z.coerce.boolean().optional(),
  })
  .strict();
export const eventRegistrationParams = z
  .object({ eventId: objectId, registrationId: objectId })
  .strict();
export const eventRegistrationStatusUpdate = z
  .object({ status: z.enum(['REGISTERED', 'ATTENDED', 'NO_SHOW', 'CANCELLED']) })
  .strict();
