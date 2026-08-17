import { Types, type ClientSession } from 'mongoose';
import type {
  ApiCollection,
  EventType,
  CommunityPrivacy,
  CommunityMemberRole,
  CommunityMemberStatus,
  DiscussionType,
  EventMode,
  EventRegistrationStatus,
  EventStatus,
  EventVisibility,
  MilestoneStatus,
  ProjectMemberRole,
  ProjectResourceType,
  ProjectVisibility,
  TaskPriority,
  TaskStatus,
  TeamStatus,
  TeamMemberRole,
  TeamVisibility,
} from '@campusconnection/shared';
import { decodeCursor, encodeCursor } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { OutboxEventPublisher } from '../../../infrastructure/events/event-publisher';
import { UserRepository } from '../../identity/infrastructure/identity.repositories';
import { BlockRepository } from '../../social/infrastructure/social.repositories';
import { withMongoTransaction } from './collaboration.transaction';
import {
  CommunityRepository,
  DiscussionRepository,
  EventRepository,
  ProjectRepository,
  ReplyRepository,
  TeamRepository,
} from '../infrastructure/collaboration.repositories';
import type {
  CommunityDocument,
  CommunityBanDocument,
  CommunityInvitationDocument,
  CommunityJoinRequestDocument,
  CommunityReportDocument,
  CommunityMemberDocument,
  DiscussionDocument,
  EventDocument,
  EventRegistrationDocument,
  ReplyDocument,
  MilestoneDocument,
  ProjectActivityDocument,
  ProjectDocument,
  ProjectInvitationDocument,
  ProjectJoinRequestDocument,
  ProjectMemberDocument,
  ProjectResourceDocument,
  TaskDocument,
  TeamDocument,
  TeamJoinRequestDocument,
  TeamInvitationDocument,
  TeamMemberDocument,
  TeamRequirementDocument,
} from '../infrastructure/collaboration.models';
import type { UserDocument } from '../../identity/infrastructure/user.model';

interface Actor {
  userId: string;
  accountState: string;
  roles: string[];
}
interface CursorInput {
  limit: number;
  cursor?: string;
}
interface CollaborationDependencies {
  communities?: CommunityRepository;
  discussions?: DiscussionRepository;
  replies?: ReplyRepository;
  teams?: TeamRepository;
  projects?: ProjectRepository;
  eventRecords?: EventRepository;
  users?: UserRepository;
  blocks?: BlockRepository;
  events?: OutboxEventPublisher;
}

export class CollaborationService {
  private readonly communities: CommunityRepository;
  private readonly discussions: DiscussionRepository;
  private readonly replies: ReplyRepository;
  private readonly teams: TeamRepository;
  private readonly projects: ProjectRepository;
  private readonly eventRecords: EventRepository;
  private readonly users: UserRepository;
  private readonly blocks: BlockRepository;
  private readonly events: OutboxEventPublisher;
  public constructor(dependencies: CollaborationDependencies = {}) {
    this.communities = dependencies.communities ?? new CommunityRepository();
    this.discussions = dependencies.discussions ?? new DiscussionRepository();
    this.replies = dependencies.replies ?? new ReplyRepository();
    this.teams = dependencies.teams ?? new TeamRepository();
    this.projects = dependencies.projects ?? new ProjectRepository();
    this.eventRecords = dependencies.eventRecords ?? new EventRepository();
    this.users = dependencies.users ?? new UserRepository();
    this.blocks = dependencies.blocks ?? new BlockRepository();
    this.events = dependencies.events ?? new OutboxEventPublisher();
  }
  private id(value: string) {
    return new Types.ObjectId(value);
  }
  private active(actor: Actor) {
    if (actor.accountState !== 'ACTIVE')
      throw new AppError(
        'ACCOUNT_RESTRICTED',
        'Your account cannot perform this collaboration action.',
        403,
      );
  }
  private cursorFilter(cursor?: string): Record<string, unknown> {
    if (!cursor) return {};
    try {
      const value = decodeCursor(cursor);
      if (!Types.ObjectId.isValid(value.id)) throw new Error();
      const date = new Date(value.createdAt);
      if (Number.isNaN(date.valueOf())) throw new Error();
      return {
        $or: [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: this.id(value.id) } }],
      };
    } catch {
      throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
    }
  }
  private page<T extends { id: string }>(items: T[], limit: number): ApiCollection<T> {
    const data = items.slice(0, limit);
    const last = data[data.length - 1];
    const createdAt =
      last && 'createdAt' in last
        ? String((last as Record<string, unknown>).createdAt)
        : new Date().toISOString();
    return {
      data,
      pagination: {
        hasMore: items.length > limit,
        nextCursor: items.length > limit && last ? encodeCursor({ createdAt, id: last.id }) : null,
      },
    };
  }
  private async requireUser(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || ['BANNED', 'SUSPENDED', 'DELETED'].includes(user.accountState))
      throw new AppError('RESOURCE_NOT_FOUND', 'The user was not found.', 404);
    return user;
  }
  private async record(
    type: EventType,
    aggregateType: string,
    aggregateId: string,
    actorId: string,
    correlationId: string,
    payload: Record<string, unknown>,
    session: ClientSession,
  ) {
    await this.events.record(
      {
        eventType: type,
        producer: 'collaboration',
        aggregateType,
        aggregateId,
        actorId,
        correlationId,
        payload,
      },
      session,
    );
  }
  private communityView(item: CommunityDocument) {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      category: item.category,
      tags: item.tags ?? [],
      rules: item.rules ?? [],
      ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {}),
      ...(item.bannerUrl ? { bannerUrl: item.bannerUrl } : {}),
      ...(item.collegeId ? { collegeId: item.collegeId } : {}),
      privacy: item.privacy,
      status: item.status,
      ownerId: item.ownerId.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private membershipView(item: CommunityMemberDocument) {
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      userId: item.userId.toString(),
      role: item.role,
      status: item.status,
      ...(item.joinedAt ? { joinedAt: item.joinedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private joinRequestView(item: CommunityJoinRequestDocument) {
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      userId: item.userId.toString(),
      status: item.status,
      ...(item.message ? { message: item.message } : {}),
      ...(item.reviewedBy ? { reviewedBy: item.reviewedBy.toString() } : {}),
      ...(item.reviewedAt ? { reviewedAt: item.reviewedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private async communityInvitationView(item: CommunityInvitationDocument) {
    const community = await this.communities.findById(item.communityId.toString());
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      inviterId: item.inviterId.toString(),
      inviteeId: item.inviteeId.toString(),
      status: item.status,
      ...(community
        ? {
            community: {
              id: community.id,
              name: community.name,
              slug: community.slug,
              ...(community.avatarUrl ? { avatarUrl: community.avatarUrl } : {}),
            },
          }
        : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private banView(item: CommunityBanDocument) {
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      userId: item.userId.toString(),
      bannedBy: item.bannedBy.toString(),
      ...(item.reason ? { reason: item.reason } : {}),
      ...(item.expiresAt ? { expiresAt: item.expiresAt.toISOString() } : {}),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    };
  }
  private reportView(item: CommunityReportDocument) {
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      reporterId: item.reporterId.toString(),
      targetType: item.targetType,
      targetId: item.targetId.toString(),
      reason: item.reason,
      status: item.status,
      ...(item.reviewedBy ? { reviewedBy: item.reviewedBy.toString() } : {}),
      ...(item.resolution ? { resolution: item.resolution } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private userSummary(user: UserDocument) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }
  private async communityViewFor(actor: Actor, item: CommunityDocument) {
    const [member, memberCount] = await Promise.all([
      this.communities.findMember(item.id, actor.userId),
      this.communities.countMembers(item.id),
    ]);
    return {
      ...this.communityView(item),
      memberCount,
      isMember: member?.status === 'ACTIVE' || item.ownerId.toString() === actor.userId,
      ...(member ? { membershipStatus: member.status } : {}),
      ...(member
        ? { membershipRole: member.role }
        : item.ownerId.toString() === actor.userId
          ? { membershipRole: 'OWNER' as const }
          : {}),
    };
  }
  private async discussionView(item: DiscussionDocument) {
    const author = await this.requireUser(item.authorId.toString());
    return {
      id: item.id,
      communityId: item.communityId.toString(),
      author: this.userSummary(author),
      title: item.title,
      content: item.content,
      type: item.type,
      tags: item.tags,
      replyCount: item.replyCount,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private async replyView(item: ReplyDocument) {
    const author = await this.requireUser(item.authorId.toString());
    return {
      id: item.id,
      discussionId: item.discussionId.toString(),
      author: this.userSummary(author),
      content: item.content,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private teamView(item: TeamDocument) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      ...(item.goal ? { goal: item.goal } : {}),
      ...(item.category ? { category: item.category } : {}),
      tags: item.tags ?? [],
      ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {}),
      ...(item.deadline ? { deadline: item.deadline.toISOString() } : {}),
      lookingFor: item.lookingFor ?? [],
      ownerId: item.ownerId.toString(),
      ...(item.projectId ? { projectId: item.projectId.toString() } : {}),
      ...(item.communityId ? { communityId: item.communityId.toString() } : {}),
      status: item.status,
      ...(item.maxMembers ? { maxMembers: item.maxMembers } : {}),
      visibility: item.visibility,
      memberCount: item.memberCount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}),
    };
  }
  private teamMemberView(item: TeamMemberDocument) {
    return {
      id: item.id,
      teamId: item.teamId.toString(),
      userId: item.userId.toString(),
      role: item.role === ('ADMIN' as TeamMemberRole) ? 'CO_LEAD' : item.role,
      status: item.status,
      ...(item.joinedAt ? { joinedAt: item.joinedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private async invitationView(item: TeamInvitationDocument) {
    const team = await this.teams.findById(item.teamId.toString());
    return {
      id: item.id,
      teamId: item.teamId.toString(),
      inviterId: item.inviterId.toString(),
      inviteeId: item.inviteeId.toString(),
      status: item.status,
      ...(item.respondedAt ? { respondedAt: item.respondedAt.toISOString() } : {}),
      ...(item.expiresAt ? { expiresAt: item.expiresAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      ...(team
        ? { team: { id: team.id, name: team.name, ...(team.goal ? { goal: team.goal } : {}) } }
        : {}),
    };
  }
  private teamJoinRequestView(item: TeamJoinRequestDocument) {
    return {
      id: item.id,
      teamId: item.teamId.toString(),
      userId: item.userId.toString(),
      ...(item.message ? { message: item.message } : {}),
      status: item.status,
      ...(item.reviewedBy ? { reviewedBy: item.reviewedBy.toString() } : {}),
      ...(item.reviewedAt ? { reviewedAt: item.reviewedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private async teamViewFor(actor: Actor, item: TeamDocument) {
    const [member, memberCount] = await Promise.all([
      this.teams.findMember(item.id, actor.userId),
      this.teams.countMembers(item.id),
    ]);
    return {
      ...this.teamView(item),
      memberCount,
      isMember: member?.status === 'ACTIVE' || item.ownerId.toString() === actor.userId,
      ...(member ? { membershipStatus: member.status } : {}),
      ...(member
        ? {
            membershipRole:
              member.role === ('ADMIN' as TeamMemberRole) ? ('CO_LEAD' as const) : member.role,
          }
        : item.ownerId.toString() === actor.userId
          ? { membershipRole: 'OWNER' as const }
          : {}),
    };
  }
  private projectView(item: ProjectDocument) {
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      ...(item.objective ? { objective: item.objective } : {}),
      ...(item.category ? { category: item.category } : {}),
      tags: item.tags ?? [],
      ...(item.ownerTeamId ? { ownerTeamId: item.ownerTeamId.toString() } : {}),
      ...(item.teamId ? { teamId: item.teamId.toString() } : {}),
      ownerId: item.ownerId.toString(),
      status: item.status,
      visibility: item.visibility,
      technologies: item.technologies,
      lookingFor: item.lookingFor ?? [],
      ...(item.deadline ? { deadline: item.deadline.toISOString() } : {}),
      ...(item.coverImageUrl ? { coverImageUrl: item.coverImageUrl } : {}),
      ...(item.repositoryUrl ? { repositoryUrl: item.repositoryUrl } : {}),
      ...(item.demoUrl ? { demoUrl: item.demoUrl } : {}),
      showcaseEnabled: item.showcaseEnabled,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}),
    };
  }
  private async projectViewFor(actor: Actor, item: ProjectDocument) {
    const [member, memberCount, tasks, completedTasks] = await Promise.all([
      this.projects.findMember(item.id, actor.userId),
      this.projects.countMembers(item.id),
      this.projects.listTasks(item.id, { archivedAt: { $exists: false } }, 1000),
      this.projects.listTasks(item.id, { archivedAt: { $exists: false }, status: 'DONE' }, 1000),
    ]);
    return {
      ...this.projectView(item),
      memberCount,
      taskCount: tasks.length,
      completedTaskCount: completedTasks.length,
      progressPercent: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
      isMember: member?.status === 'ACTIVE' || item.ownerId.toString() === actor.userId,
      ...(member ? { membershipStatus: member.status } : {}),
      ...(member
        ? {
            membershipRole:
              member.role === ('MANAGER' as ProjectMemberRole) ||
              member.role === ('MEMBER' as ProjectMemberRole)
                ? ('COLLABORATOR' as const)
                : member.role,
          }
        : item.ownerId.toString() === actor.userId
          ? { membershipRole: 'OWNER' as const }
          : {}),
    };
  }
  private projectMemberView(item: ProjectMemberDocument) {
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      userId: item.userId.toString(),
      role:
        item.role === ('MANAGER' as ProjectMemberRole) ||
        item.role === ('MEMBER' as ProjectMemberRole)
          ? 'COLLABORATOR'
          : item.role,
      status: item.status,
      ...(item.joinedAt ? { joinedAt: item.joinedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private taskView(item: TaskDocument) {
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      title: item.title,
      description: item.description,
      creatorId: item.creatorId.toString(),
      ...(item.assigneeId ? { assigneeId: item.assigneeId.toString() } : {}),
      status: item.status,
      priority: item.priority,
      ...(item.dueDate ? { dueDate: item.dueDate.toISOString() } : {}),
      ...(item.completedAt ? { completedAt: item.completedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private milestoneView(item: MilestoneDocument) {
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      title: item.title,
      description: item.description,
      status: item.status === ('PLANNED' as MilestoneStatus) ? 'UPCOMING' : item.status,
      ...(item.dueDate ? { dueDate: item.dueDate.toISOString() } : {}),
      order: item.order,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      ...(item.createdBy ? { createdBy: item.createdBy.toString() } : {}),
    };
  }
  private projectJoinRequestView(item: ProjectJoinRequestDocument) {
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      userId: item.userId.toString(),
      ...(item.message ? { message: item.message } : {}),
      status: item.status,
      ...(item.reviewedBy ? { reviewedBy: item.reviewedBy.toString() } : {}),
      ...(item.reviewedAt ? { reviewedAt: item.reviewedAt.toISOString() } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private async projectInvitationView(item: ProjectInvitationDocument) {
    const project = await this.projects.findById(item.projectId.toString());
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      inviterId: item.inviterId.toString(),
      inviteeId: item.inviteeId.toString(),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      ...(item.respondedAt ? { respondedAt: item.respondedAt.toISOString() } : {}),
      ...(item.expiresAt ? { expiresAt: item.expiresAt.toISOString() } : {}),
      ...(project
        ? {
            project: {
              id: project.id,
              name: project.name,
              ...(project.objective ? { objective: project.objective } : {}),
            },
          }
        : {}),
    };
  }
  private projectResourceView(item: ProjectResourceDocument) {
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      title: item.title,
      url: item.url,
      type: item.type,
      createdBy: item.createdBy.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private projectActivityView(item: ProjectActivityDocument) {
    const metadata =
      item.metadata instanceof Map ? Object.fromEntries(item.metadata.entries()) : item.metadata;
    return {
      id: item.id,
      projectId: item.projectId.toString(),
      actorId: item.actorId.toString(),
      type: item.type,
      message: item.message,
      ...(metadata ? { metadata } : {}),
      createdAt: item.createdAt.toISOString(),
    };
  }
  private requirementView(item: TeamRequirementDocument) {
    return {
      id: item.id,
      teamId: item.teamId.toString(),
      roleName: item.roleName,
      skills: item.skills,
      interests: item.interests,
      ...(item.experienceLevel ? { experienceLevel: item.experienceLevel } : {}),
      slots: item.slots,
      filledSlots: item.filledSlots,
      description: item.description,
      priority: item.priority,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  async listTeamRequirements(actor: Actor, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    await this.teamAccess(actor, team);
    const items = await this.teams.listRequirements(teamId);
    return {
      data: items.map((item) => this.requirementView(item)),
      pagination: { hasMore: false, nextCursor: null },
    };
  }
  async createTeamRequirement(
    actor: Actor,
    teamId: string,
    input: {
      roleName: string;
      skills: string[];
      interests: string[];
      experienceLevel?: string;
      slots: number;
      description: string;
      priority: number;
    },
    correlationId: string,
  ) {
    this.active(actor);
    await this.teamManager(actor, teamId);
    const requirement = await withMongoTransaction(async (session) => {
      const created = await this.teams.createRequirement(
        { teamId: this.id(teamId), ...input, filledSlots: 0 },
        session,
      );
      await this.record(
        'TEAM_REQUIREMENT_CREATED',
        'TEAM_REQUIREMENT',
        created.id,
        actor.userId,
        correlationId,
        { teamId, requirementId: created.id },
        session,
      );
      await this.record(
        'SEARCH_INDEX_UPDATE_REQUESTED',
        'TEAM',
        teamId,
        actor.userId,
        correlationId,
        { teamId, reason: 'TEAM_REQUIREMENT_CREATED' },
        session,
      );
      return created;
    });
    return this.requirementView(requirement);
  }
  async updateTeamRequirement(
    actor: Actor,
    requirementId: string,
    input: Partial<{
      roleName: string;
      skills: string[];
      interests: string[];
      experienceLevel: string;
      slots: number;
      description: string;
      priority: number;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    const requirement = await this.teams.findRequirement(requirementId);
    if (!requirement)
      throw new AppError('RESOURCE_NOT_FOUND', 'The team requirement was not found.', 404);
    await this.teamManager(actor, requirement.teamId.toString());
    if (input.slots !== undefined && input.slots < requirement.filledSlots)
      throw new AppError('INVALID_REQUIREMENT', 'Slots cannot be lower than filled slots.', 422);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.teams.updateRequirement(requirementId, input, session);
      if (!result)
        throw new AppError('RESOURCE_NOT_FOUND', 'The team requirement was not found.', 404);
      await this.record(
        'TEAM_REQUIREMENT_UPDATED',
        'TEAM_REQUIREMENT',
        requirementId,
        actor.userId,
        correlationId,
        { teamId: requirement.teamId.toString(), requirementId },
        session,
      );
      await this.record(
        'SEARCH_INDEX_UPDATE_REQUESTED',
        'TEAM',
        requirement.teamId.toString(),
        actor.userId,
        correlationId,
        { teamId: requirement.teamId.toString(), reason: 'TEAM_REQUIREMENT_UPDATED' },
        session,
      );
      return result;
    });
    return this.requirementView(updated);
  }
  async deleteTeamRequirement(actor: Actor, requirementId: string, correlationId: string) {
    this.active(actor);
    const requirement = await this.teams.findRequirement(requirementId);
    if (!requirement)
      throw new AppError('RESOURCE_NOT_FOUND', 'The team requirement was not found.', 404);
    await this.teamManager(actor, requirement.teamId.toString());
    await withMongoTransaction(async (session) => {
      await this.teams.deleteRequirement(requirementId, session);
      await this.record(
        'TEAM_REQUIREMENT_DELETED',
        'TEAM_REQUIREMENT',
        requirementId,
        actor.userId,
        correlationId,
        { teamId: requirement.teamId.toString(), requirementId },
        session,
      );
      await this.record(
        'SEARCH_INDEX_UPDATE_REQUESTED',
        'TEAM',
        requirement.teamId.toString(),
        actor.userId,
        correlationId,
        { teamId: requirement.teamId.toString(), reason: 'TEAM_REQUIREMENT_DELETED' },
        session,
      );
    });
  }

  private async communityAccess(actor: Actor, community: CommunityDocument, write = false) {
    if (community.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    const member = await this.communities.findMember(community.id, actor.userId);
    const allowed =
      community.ownerId.toString() === actor.userId ||
      community.privacy !== 'PRIVATE' ||
      member?.status === 'ACTIVE';
    if (!allowed) throw new AppError('FORBIDDEN', 'You cannot access this community.', 403);
    if (write && !member?.status?.match(/ACTIVE/))
      throw new AppError('FORBIDDEN', 'Active community membership is required.', 403);
    return member;
  }
  private async communityAdmin(actor: Actor, communityId: string) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    const member = await this.communityAccess(actor, community, true);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role))
      throw new AppError('FORBIDDEN', 'Community administration permission is required.', 403);
    return community;
  }
  private async teamAccess(actor: Actor, team: TeamDocument, write = false) {
    const member = await this.teams.findMember(team.id, actor.userId);
    const allowed =
      team.ownerId.toString() === actor.userId ||
      team.visibility !== 'PRIVATE' ||
      member?.status === 'ACTIVE';
    if (!allowed) throw new AppError('FORBIDDEN', 'You cannot access this team.', 403);
    if (
      write &&
      (member?.status !== 'ACTIVE' || team.status === 'ARCHIVED' || team.status === 'COMPLETED')
    )
      throw new AppError('FORBIDDEN', 'Active team membership is required.', 403);
    return member;
  }
  private async teamManager(actor: Actor, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    const member = await this.teamAccess(actor, team, true);
    if (
      !member ||
      !['OWNER', 'CO_LEAD'].includes(
        member.role === ('ADMIN' as TeamMemberRole) ? 'CO_LEAD' : member.role,
      )
    )
      throw new AppError('FORBIDDEN', 'Team administration permission is required.', 403);
    return team;
  }
  private async teamOwner(actor: Actor, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    const member = await this.teamAccess(actor, team, false);
    if (!member || member.status !== 'ACTIVE' || member.role !== 'OWNER')
      throw new AppError('FORBIDDEN', 'Only the team owner can perform this action.', 403);
    return team;
  }
  private async projectAccess(actor: Actor, project: ProjectDocument, write = false) {
    const member = await this.projects.findMember(project.id, actor.userId);
    const allowed =
      project.ownerId.toString() === actor.userId ||
      ['PUBLIC', 'CAMPUS', 'CONNECTIONS'].includes(project.visibility) ||
      member?.status === 'ACTIVE';
    if (!allowed) throw new AppError('FORBIDDEN', 'You cannot access this project.', 403);
    if (
      write &&
      (member?.status !== 'ACTIVE' ||
        project.status === 'COMPLETED' ||
        project.status === 'ARCHIVED')
    )
      throw new AppError('FORBIDDEN', 'Active project membership is required.', 403);
    return member;
  }
  private async projectManager(actor: Actor, projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projectAccess(actor, project, true);
    const role =
      member?.role === ('MANAGER' as ProjectMemberRole) ||
      member?.role === ('MEMBER' as ProjectMemberRole)
        ? 'COLLABORATOR'
        : member?.role;
    if (!member || !['OWNER'].includes(role ?? ''))
      throw new AppError('FORBIDDEN', 'Project management permission is required.', 403);
    return project;
  }
  private async projectOwner(actor: Actor, projectId: string, allowCompleted = false) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projects.findMember(projectId, actor.userId);
    const role =
      member?.role === ('MANAGER' as ProjectMemberRole) ||
      member?.role === ('MEMBER' as ProjectMemberRole)
        ? 'COLLABORATOR'
        : member?.role;
    if (!member || member.status !== 'ACTIVE' || role !== 'OWNER')
      throw new AppError('FORBIDDEN', 'Only the project owner can perform this action.', 403);
    if (project.status === 'ARCHIVED' || (!allowCompleted && project.status === 'COMPLETED'))
      throw new AppError('PROJECT_CLOSED', 'This project is no longer editable.', 409);
    return project;
  }

  async createCommunity(
    actor: Actor,
    input: {
      name: string;
      slug: string;
      description: string;
      category: string;
      tags: string[];
      rules: string[];
      avatarUrl?: string;
      bannerUrl?: string;
      collegeId?: string;
      privacy: CommunityPrivacy;
    },
    correlationId: string,
  ) {
    this.active(actor);
    await this.requireUser(actor.userId);
    if (await this.communities.findBySlug(input.slug))
      throw new AppError('SLUG_EXISTS', 'That community slug is already in use.', 409);
    return withMongoTransaction(async (session) => {
      const community = await this.communities.create(
        { ...input, ownerId: this.id(actor.userId), status: 'ACTIVE', memberCount: 1 },
        session,
      );
      await this.communities.saveMember(
        community.id,
        actor.userId,
        { role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'COMMUNITY_CREATED',
        'COMMUNITY',
        community.id,
        actor.userId,
        correlationId,
        { communityId: community.id },
        session,
      );
      return this.communityView(community);
    });
  }
  async listCommunities(
    actor: Actor,
    input: CursorInput & { search?: string; category?: string; tags?: string },
  ) {
    const search = input.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cursor = this.cursorFilter(input.cursor);
    const textFilter = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { description: new RegExp(search, 'i') }] }
      : {};
    const tags = input.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const items = await this.communities.list(
      {
        status: 'ACTIVE',
        ...(input.category ? { category: input.category } : {}),
        ...(tags?.length
          ? {
              tags: {
                $in: tags.map(
                  (tag) => new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                ),
              },
            }
          : {}),
        ...(search && Object.keys(cursor).length ? { $and: [textFilter, cursor] } : textFilter),
        ...(!search || !Object.keys(cursor).length ? cursor : {}),
      },
      input.limit + 1,
    );
    const allowed: Array<Awaited<ReturnType<typeof this.communityViewFor>>> = [];
    for (const item of items) {
      const view = await this.communityViewFor(actor, item);
      if (item.privacy !== 'PRIVATE' || view.isMember) allowed.push(view);
      if (allowed.length === input.limit) break;
    }
    return this.page(allowed, input.limit);
  }
  async listMyCommunities(actor: Actor, input: CursorInput) {
    const memberships = await this.communities.listMemberCommunities(actor.userId, input.limit + 1);
    const communities = [];
    for (const membership of memberships) {
      const community = await this.communities.findById(membership.communityId.toString());
      if (community?.status === 'ACTIVE')
        communities.push(await this.communityViewFor(actor, community));
      if (communities.length === input.limit) break;
    }
    return this.page(communities, input.limit);
  }
  async getCommunity(actor: Actor, communityId: string) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community);
    return this.communityViewFor(actor, community);
  }
  async updateCommunity(
    actor: Actor,
    communityId: string,
    input: Partial<{
      name: string;
      description: string;
      category: string;
      tags: string[];
      rules: string[];
      avatarUrl?: string;
      bannerUrl?: string;
      privacy: CommunityPrivacy;
      collegeId: string;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    await this.communityAdmin(actor, communityId);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.communities.update(communityId, input, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
      await this.record(
        'COMMUNITY_UPDATED',
        'COMMUNITY',
        communityId,
        actor.userId,
        correlationId,
        { communityId },
        session,
      );
      return result;
    });
    return this.communityView(updated);
  }
  async archiveCommunity(actor: Actor, communityId: string, correlationId: string) {
    this.active(actor);
    const community = await this.communityAdmin(actor, communityId);
    if (community.ownerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the community owner can delete the community.', 403);
    await withMongoTransaction(async (session) => {
      await this.communities.update(communityId, { status: 'ARCHIVED' }, session);
      await this.record(
        'COMMUNITY_UPDATED',
        'COMMUNITY',
        communityId,
        actor.userId,
        correlationId,
        { communityId, status: 'ARCHIVED' },
        session,
      );
    });
  }
  async joinCommunity(actor: Actor, communityId: string, correlationId: string) {
    this.active(actor);
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.requireUser(actor.userId);
    if (await this.communities.findActiveBan(communityId, actor.userId))
      throw new AppError('COMMUNITY_BANNED', 'You are banned from this community.', 403);
    if (community.ownerId.toString() === actor.userId)
      throw new AppError('MEMBERSHIP_EXISTS', 'You are already the community owner.', 409);
    if (await this.blocks.eitherBlocked(actor.userId, community.ownerId.toString()))
      throw new AppError('FORBIDDEN', 'This community interaction is not available.', 403);
    const existing = await this.communities.findMember(communityId, actor.userId);
    if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING')
      throw new AppError('MEMBERSHIP_EXISTS', 'A membership already exists.', 409);
    const status: CommunityMemberStatus = community.privacy === 'PRIVATE' ? 'PENDING' : 'ACTIVE';
    const member = await withMongoTransaction(async (session) => {
      const result = await this.communities.saveMember(
        communityId,
        actor.userId,
        { role: 'MEMBER', status, ...(status === 'ACTIVE' ? { joinedAt: new Date() } : {}) },
        session,
      );
      if (status === 'PENDING') {
        const request = await this.communities.createJoinRequest(
          { communityId: this.id(communityId), userId: this.id(actor.userId), status: 'PENDING' },
          session,
        );
        await this.record(
          'COMMUNITY_JOIN_REQUESTED',
          'COMMUNITY_JOIN_REQUEST',
          request.id,
          actor.userId,
          correlationId,
          { communityId, targetUserId: community.ownerId.toString() },
          session,
        );
      }
      if (status === 'ACTIVE') await this.communities.incrementMemberCount(communityId, 1, session);
      if (status === 'ACTIVE')
        await this.record(
          'COMMUNITY_JOINED',
          'COMMUNITY_MEMBER',
          result.id,
          actor.userId,
          correlationId,
          { communityId, targetUserId: community.ownerId.toString() },
          session,
        );
      return result;
    });
    return this.membershipView(member);
  }
  async leaveCommunity(actor: Actor, communityId: string, correlationId: string) {
    this.active(actor);
    const member = await this.communities.findMember(communityId, actor.userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Active community membership was not found.', 404);
    if (member.role === 'OWNER')
      throw new AppError('OWNER_CANNOT_LEAVE', 'Transfer community ownership before leaving.', 422);
    await withMongoTransaction(async (session) => {
      await this.communities.updateMember(communityId, actor.userId, { status: 'LEFT' }, session);
      await this.communities.incrementMemberCount(communityId, -1, session);
      await this.record(
        'COMMUNITY_LEFT',
        'COMMUNITY_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { communityId },
        session,
      );
    });
  }
  async listCommunityMembers(actor: Actor, communityId: string, input: CursorInput) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community);
    const members = await this.communities.listMembers(
      communityId,
      { status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const users = await this.users.findByIds(members.map((item) => item.userId));
    const userMap = new Map(users.map((user) => [user.id, user]));
    return this.page(
      members.flatMap((item) => {
        const user = userMap.get(item.userId.toString());
        return user ? [{ ...this.membershipView(item), user: this.userSummary(user) }] : [];
      }),
      input.limit,
    );
  }
  async listDiscussions(actor: Actor, communityId: string, input: CursorInput) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community);
    const discussions = await this.discussions.list(
      { communityId, status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const views = await Promise.all(discussions.map((item) => this.discussionView(item)));
    return this.page(views, input.limit);
  }
  async listActiveDiscussions(actor: Actor, input: CursorInput) {
    const communities = await this.communities.list({ status: 'ACTIVE' }, 100);
    const accessibleIds: string[] = [];
    for (const community of communities) {
      const member = await this.communities.findMember(community.id, actor.userId);
      if (
        community.privacy !== 'PRIVATE' ||
        community.ownerId.toString() === actor.userId ||
        member?.status === 'ACTIVE'
      ) {
        accessibleIds.push(community.id);
      }
    }
    if (accessibleIds.length === 0) return this.page([], input.limit);
    const discussions = await this.discussions.list(
      { communityId: { $in: accessibleIds }, status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const views = await Promise.all(discussions.map((item) => this.discussionView(item)));
    return this.page(views, input.limit);
  }
  async createDiscussion(
    actor: Actor,
    communityId: string,
    input: { title: string; content: string; type: DiscussionType; tags: string[] },
    correlationId: string,
  ) {
    this.active(actor);
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community, true);
    const discussion = await withMongoTransaction(async (session) => {
      const created = await this.discussions.create(
        {
          communityId: this.id(communityId),
          authorId: this.id(actor.userId),
          ...input,
          status: 'ACTIVE',
          replyCount: 0,
        },
        session,
      );
      await this.record(
        'DISCUSSION_CREATED',
        'DISCUSSION',
        created.id,
        actor.userId,
        correlationId,
        { communityId },
        session,
      );
      return created;
    });
    return this.discussionView(discussion);
  }
  async getDiscussion(actor: Actor, discussionId: string) {
    const discussion = await this.discussions.findById(discussionId);
    if (!discussion) throw new AppError('RESOURCE_NOT_FOUND', 'The discussion was not found.', 404);
    const community = await this.communities.findById(discussion.communityId.toString());
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community);
    return this.discussionView(discussion);
  }
  async createReply(actor: Actor, discussionId: string, content: string, correlationId: string) {
    this.active(actor);
    const discussion = await this.discussions.findById(discussionId);
    if (!discussion) throw new AppError('RESOURCE_NOT_FOUND', 'The discussion was not found.', 404);
    const community = await this.communities.findById(discussion.communityId.toString());
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community, true);
    const reply = await withMongoTransaction(async (session) => {
      const created = await this.replies.create(
        {
          discussionId: this.id(discussionId),
          authorId: this.id(actor.userId),
          content,
          status: 'ACTIVE',
        },
        session,
      );
      const updated = await this.discussions.incrementReplyCount(discussionId, session);
      if (!updated) throw new AppError('RESOURCE_NOT_FOUND', 'The discussion was not found.', 404);
      await this.record(
        'REPLY_CREATED',
        'REPLY',
        created.id,
        actor.userId,
        correlationId,
        { discussionId, communityId: community.id },
        session,
      );
      return created;
    });
    return this.replyView(reply);
  }
  async listReplies(actor: Actor, discussionId: string, input: CursorInput) {
    const discussion = await this.discussions.findById(discussionId);
    if (!discussion) throw new AppError('RESOURCE_NOT_FOUND', 'The discussion was not found.', 404);
    const community = await this.communities.findById(discussion.communityId.toString());
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community);
    const replies = await this.replies.list(
      { discussionId, status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const views = await Promise.all(replies.map((item) => this.replyView(item)));
    return this.page(views, input.limit);
  }
  async updateCommunityMember(
    actor: Actor,
    communityId: string,
    userId: string,
    input: { role?: CommunityMemberRole; status?: CommunityMemberStatus },
    correlationId: string,
  ) {
    this.active(actor);
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community, true);
    const actorMember = await this.communities.findMember(communityId, actor.userId);
    if (!actorMember || !['OWNER', 'ADMIN', 'MODERATOR'].includes(actorMember.role))
      throw new AppError('FORBIDDEN', 'Community management permission is required.', 403);
    const target = await this.communities.findMember(communityId, userId);
    if (!target) throw new AppError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
    const rank = (role: CommunityMemberRole) =>
      ({ MEMBER: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 })[role];
    if (rank(target.role) >= rank(actorMember.role) && target.userId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'You cannot manage an equal or higher authority.', 403);
    if (actorMember.role === 'MODERATOR' && input.role)
      throw new AppError('FORBIDDEN', 'Moderators cannot change member roles.', 403);
    if (input.role === 'OWNER')
      throw new AppError(
        'FORBIDDEN',
        'Only the community owner can assign administrator access.',
        403,
      );
    if (userId === actor.userId && input.status === 'BANNED')
      throw new AppError('INVALID_MEMBERSHIP', 'You cannot ban yourself.', 422);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.communities.updateMember(communityId, userId, input, session);
      if (!result) throw new AppError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
      if (input.status && input.status !== target.status) {
        const wasActive = target.status === 'ACTIVE';
        const isActive = input.status === 'ACTIVE';
        if (wasActive !== isActive) {
          await this.communities.incrementMemberCount(communityId, isActive ? 1 : -1, session);
        }
      }
      if (input.status === 'ACTIVE')
        await this.record(
          'COMMUNITY_JOINED',
          'COMMUNITY_MEMBER',
          result.id,
          actor.userId,
          correlationId,
          { communityId, userId },
          session,
        );
      if (input.status === 'LEFT')
        await this.record(
          'COMMUNITY_MEMBER_REMOVED',
          'COMMUNITY_MEMBER',
          result.id,
          actor.userId,
          correlationId,
          { communityId, targetUserId: userId },
          session,
        );
      return result;
    });
    return this.membershipView(updated);
  }

  async transferCommunityOwnership(
    actor: Actor,
    communityId: string,
    userId: string,
    correlationId: string,
  ) {
    this.active(actor);
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    if (community.ownerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the community owner can transfer ownership.', 403);
    const target = await this.communities.findMember(communityId, userId);
    if (!target || target.status !== 'ACTIVE' || target.role === 'OWNER')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'An active non-owner member is required.', 422);

    const updated = await withMongoTransaction(async (session) => {
      const nextOwner = await this.communities.updateMember(
        communityId,
        userId,
        { role: 'OWNER' },
        session,
      );
      const previousOwner = await this.communities.updateMember(
        communityId,
        actor.userId,
        { role: 'ADMIN' },
        session,
      );
      const updatedCommunity = await this.communities.update(
        communityId,
        { ownerId: this.id(userId) },
        session,
      );
      if (!nextOwner || !previousOwner || !updatedCommunity)
        throw new AppError(
          'MEMBERSHIP_NOT_FOUND',
          'Ownership transfer could not be completed.',
          422,
        );
      await this.record(
        'COMMUNITY_UPDATED',
        'COMMUNITY',
        communityId,
        actor.userId,
        correlationId,
        { communityId, ownerId: userId },
        session,
      );
      return updatedCommunity;
    });
    return this.communityView(updated);
  }

  private async communityModerator(actor: Actor, communityId: string) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    const member = await this.communityAccess(actor, community, true);
    if (!member || !['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role))
      throw new AppError('FORBIDDEN', 'Community moderation permission is required.', 403);
    return { community, member };
  }

  async listJoinRequests(actor: Actor, communityId: string, input: CursorInput) {
    await this.communityAdmin(actor, communityId);
    const requests = await this.communities.listJoinRequests(
      communityId,
      { status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      requests.map((item) => this.joinRequestView(item)),
      input.limit,
    );
  }
  async reviewJoinRequest(
    actor: Actor,
    communityId: string,
    requestId: string,
    approve: boolean,
    correlationId: string,
  ) {
    await this.communityAdmin(actor, communityId);
    const request = await this.communities.findJoinRequest(requestId);
    if (!request || request.communityId.toString() !== communityId || request.status !== 'PENDING')
      throw new AppError('REQUEST_NOT_FOUND', 'The join request is no longer pending.', 404);
    if (approve && (await this.communities.findActiveBan(communityId, request.userId.toString())))
      throw new AppError('COMMUNITY_BANNED', 'This user is banned from the community.', 403);
    await withMongoTransaction(async (session) => {
      await this.communities.updateJoinRequest(
        requestId,
        {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedBy: this.id(actor.userId),
          reviewedAt: new Date(),
        },
        session,
      );
      await this.communities.updateMember(
        communityId,
        request.userId.toString(),
        { status: approve ? 'ACTIVE' : 'LEFT', ...(approve ? { joinedAt: new Date() } : {}) },
        session,
      );
      if (approve) await this.communities.incrementMemberCount(communityId, 1, session);
      await this.record(
        approve ? 'COMMUNITY_JOIN_REQUEST_APPROVED' : 'COMMUNITY_JOIN_REQUEST_REJECTED',
        'COMMUNITY_JOIN_REQUEST',
        request.id,
        actor.userId,
        correlationId,
        { communityId, targetUserId: request.userId.toString() },
        session,
      );
      if (approve)
        await this.record(
          'COMMUNITY_JOINED',
          'COMMUNITY_MEMBER',
          request.id,
          actor.userId,
          correlationId,
          { communityId, userId: request.userId.toString() },
          session,
        );
    });
    return { status: approve ? 'APPROVED' : 'REJECTED' };
  }
  async inviteCommunityMember(
    actor: Actor,
    communityId: string,
    inviteeId: string,
    correlationId: string,
  ) {
    this.active(actor);
    await this.communityAdmin(actor, communityId);
    await this.requireUser(inviteeId);
    if (await this.communities.findActiveBan(communityId, inviteeId))
      throw new AppError('COMMUNITY_BANNED', 'This user is banned from the community.', 403);
    const member = await this.communities.findMember(communityId, inviteeId);
    if (member?.status === 'ACTIVE')
      throw new AppError('MEMBERSHIP_EXISTS', 'This user is already a member.', 409);
    if (await this.communities.findPendingInvitation(communityId, inviteeId))
      throw new AppError('INVITATION_EXISTS', 'An active invitation already exists.', 409);
    const invitation = await withMongoTransaction(async (session) => {
      const created = await this.communities.createInvitation(
        {
          communityId: this.id(communityId),
          inviterId: this.id(actor.userId),
          inviteeId: this.id(inviteeId),
          status: 'PENDING',
        },
        session,
      );
      await this.record(
        'COMMUNITY_INVITATION_SENT',
        'COMMUNITY_INVITATION',
        created.id,
        actor.userId,
        correlationId,
        { communityId, targetUserId: inviteeId },
        session,
      );
      return created;
    });
    return this.communityInvitationView(invitation);
  }
  async listCommunityInvitations(actor: Actor, communityId: string, input: CursorInput) {
    const member = await this.communities.findMember(communityId, actor.userId);
    const filter =
      member && ['OWNER', 'ADMIN'].includes(member.role)
        ? { communityId }
        : { communityId, inviteeId: actor.userId };
    const invitations = await this.communities.listInvitations(
      { ...filter, ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      await Promise.all(invitations.map((item) => this.communityInvitationView(item))),
      input.limit,
    );
  }
  async listMyCommunityInvitations(actor: Actor, input: CursorInput) {
    const invitations = await this.communities.listInvitations(
      { inviteeId: actor.userId, status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      await Promise.all(invitations.map((item) => this.communityInvitationView(item))),
      input.limit,
    );
  }
  async respondToCommunityInvitation(
    actor: Actor,
    invitationId: string,
    accept: boolean,
    correlationId: string,
  ) {
    const invitation = await this.communities.findInvitation(invitationId);
    if (
      !invitation ||
      invitation.inviteeId.toString() !== actor.userId ||
      invitation.status !== 'PENDING'
    )
      throw new AppError('INVITATION_NOT_FOUND', 'The invitation is no longer available.', 404);
    if (
      accept &&
      (await this.communities.findActiveBan(invitation.communityId.toString(), actor.userId))
    )
      throw new AppError('COMMUNITY_BANNED', 'You are banned from this community.', 403);
    await withMongoTransaction(async (session) => {
      await this.communities.updateInvitation(
        invitationId,
        { status: accept ? 'ACCEPTED' : 'REJECTED' },
        session,
      );
      if (accept) {
        const existing = await this.communities.findMember(
          invitation.communityId.toString(),
          actor.userId,
          session,
        );
        await this.communities.saveMember(
          invitation.communityId.toString(),
          actor.userId,
          { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
          session,
        );
        if (!existing || existing.status !== 'ACTIVE')
          await this.communities.incrementMemberCount(
            invitation.communityId.toString(),
            1,
            session,
          );
        await this.record(
          'COMMUNITY_INVITATION_ACCEPTED',
          'COMMUNITY_INVITATION',
          invitation.id,
          actor.userId,
          correlationId,
          {
            communityId: invitation.communityId.toString(),
            targetUserId: invitation.inviterId.toString(),
          },
          session,
        );
        await this.record(
          'COMMUNITY_JOINED',
          'COMMUNITY_MEMBER',
          invitation.id,
          actor.userId,
          correlationId,
          { communityId: invitation.communityId.toString() },
          session,
        );
      }
    });
    return { status: accept ? 'ACCEPTED' : 'REJECTED' };
  }
  async banCommunityMember(
    actor: Actor,
    communityId: string,
    userId: string,
    input: { reason?: string; expiresAt?: string },
    correlationId: string,
  ) {
    const { member: actorMember } = await this.communityModerator(actor, communityId);
    const target = await this.communities.findMember(communityId, userId);
    if (!target) throw new AppError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
    const rank = (role: CommunityMemberRole) =>
      ({ MEMBER: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 })[role];
    if (target.role === 'OWNER' || rank(target.role) >= rank(actorMember.role))
      throw new AppError('FORBIDDEN', 'You cannot ban an equal or higher authority.', 403);
    const ban = await withMongoTransaction(async (session) => {
      const created = await this.communities.createBan(
        {
          communityId: this.id(communityId),
          userId: this.id(userId),
          bannedBy: this.id(actor.userId),
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
          status: 'ACTIVE',
        },
        session,
      );
      await this.communities.updateMember(communityId, userId, { status: 'BANNED' }, session);
      if (target.status === 'ACTIVE')
        await this.communities.incrementMemberCount(communityId, -1, session);
      await this.record(
        'COMMUNITY_MEMBER_BANNED',
        'COMMUNITY_MEMBER',
        target.id,
        actor.userId,
        correlationId,
        { communityId, targetUserId: userId },
        session,
      );
      return created;
    });
    return this.banView(ban);
  }
  async listCommunityBans(actor: Actor, communityId: string, input: CursorInput) {
    await this.communityModerator(actor, communityId);
    const bans = await this.communities.listBans(
      communityId,
      { status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      bans.map((item) => this.banView(item)),
      input.limit,
    );
  }
  async unbanCommunityMember(
    actor: Actor,
    communityId: string,
    userId: string,
    correlationId: string,
  ) {
    await this.communityModerator(actor, communityId);
    const ban = await withMongoTransaction(async (session) => {
      const updated = await this.communities.updateBan(
        communityId,
        userId,
        { status: 'REVOKED' },
        session,
      );
      if (!updated) throw new AppError('BAN_NOT_FOUND', 'The active ban was not found.', 404);
      await this.record(
        'COMMUNITY_MEMBER_UNBANNED',
        'COMMUNITY_MEMBER',
        updated.id,
        actor.userId,
        correlationId,
        { communityId, targetUserId: userId },
        session,
      );
      return updated;
    });
    return this.banView(ban);
  }
  async createCommunityReport(
    actor: Actor,
    communityId: string,
    input: { targetType: 'POST' | 'COMMENT' | 'MEMBER'; targetId: string; reason: string },
    correlationId: string,
  ) {
    const community = await this.communities.findById(communityId);
    if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    await this.communityAccess(actor, community, true);
    const report = await withMongoTransaction(async (session) => {
      const created = await this.communities.createReport(
        {
          communityId: this.id(communityId),
          reporterId: this.id(actor.userId),
          targetType: input.targetType,
          targetId: this.id(input.targetId),
          reason: input.reason,
          status: 'OPEN',
        },
        session,
      );
      await this.record(
        'COMMUNITY_REPORT_CREATED',
        'COMMUNITY_REPORT',
        created.id,
        actor.userId,
        correlationId,
        { communityId, targetUserId: community.ownerId.toString() },
        session,
      );
      return created;
    });
    return this.reportView(report);
  }
  async listCommunityReports(actor: Actor, communityId: string, input: CursorInput) {
    await this.communityModerator(actor, communityId);
    const reports = await this.communities.listReports(
      communityId,
      { ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      reports.map((item) => this.reportView(item)),
      input.limit,
    );
  }
  async reviewCommunityReport(
    actor: Actor,
    communityId: string,
    reportId: string,
    input: { status: 'RESOLVED' | 'DISMISSED'; resolution?: string },
  ) {
    await this.communityModerator(actor, communityId);
    const report = await this.communities.updateReport(reportId, {
      ...input,
      reviewedBy: this.id(actor.userId),
    });
    if (!report || report.communityId.toString() !== communityId)
      throw new AppError('REPORT_NOT_FOUND', 'The report was not found.', 404);
    return this.reportView(report);
  }

  async createTeam(
    actor: Actor,
    input: {
      name: string;
      description: string;
      goal: string;
      category: string;
      tags: string[];
      avatarUrl?: string;
      deadline?: string;
      lookingFor: string[];
      communityId?: string;
      projectId?: string;
      maxMembers?: number;
      visibility: TeamVisibility;
    },
    correlationId: string,
  ) {
    this.active(actor);
    if (input.communityId) {
      const community = await this.communities.findById(input.communityId);
      if (!community) throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
      await this.communityAccess(actor, community, true);
    }
    const team = await withMongoTransaction(async (session) => {
      const created = await this.teams.create(
        {
          name: input.name,
          description: input.description,
          goal: input.goal,
          category: input.category,
          tags: input.tags,
          ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
          ...(input.deadline ? { deadline: new Date(input.deadline) } : {}),
          lookingFor: input.lookingFor,
          ownerId: this.id(actor.userId),
          ...(input.communityId ? { communityId: this.id(input.communityId) } : {}),
          ...(input.projectId ? { projectId: this.id(input.projectId) } : {}),
          ...(input.maxMembers ? { maxMembers: input.maxMembers } : {}),
          visibility: input.visibility,
          status: 'RECRUITING',
          memberCount: 1,
        },
        session,
      );
      await this.teams.saveMember(
        created.id,
        actor.userId,
        { role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'TEAM_CREATED',
        'TEAM',
        created.id,
        actor.userId,
        correlationId,
        { teamId: created.id },
        session,
      );
      return created;
    });
    return this.teamViewFor(actor, team);
  }
  async listTeams(
    actor: Actor,
    input: CursorInput & { search?: string; category?: string; tags?: string; available?: boolean },
  ) {
    const search = input.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = input.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const filters: Record<string, unknown>[] = [];
    if (search)
      filters.push({
        $or: [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { goal: new RegExp(search, 'i') },
        ],
      });
    if (input.available)
      filters.push({
        $or: [
          { maxMembers: { $exists: false } },
          { $expr: { $lt: ['$memberCount', '$maxMembers'] } },
        ],
      });
    const items = await this.teams.list(
      {
        status: { $in: ['RECRUITING', 'ACTIVE', 'COMPLETED'] },
        ...(input.category ? { category: input.category } : {}),
        ...(tags?.length ? { tags: { $in: tags.map((tag) => new RegExp(`^${tag}$`, 'i')) } } : {}),
        ...(filters.length ? { $and: filters } : {}),
        ...this.cursorFilter(input.cursor),
      },
      input.limit + 1,
    );
    const visible = [];
    for (const team of items) {
      if (
        team.visibility !== 'PRIVATE' ||
        team.ownerId.toString() === actor.userId ||
        (await this.teams
          .findMember(team.id, actor.userId)
          .then((member) => member?.status === 'ACTIVE'))
      )
        visible.push(await this.teamViewFor(actor, team));
      if (visible.length === input.limit) break;
    }
    return this.page(visible, input.limit);
  }
  async getTeam(actor: Actor, teamId: string) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    await this.teamAccess(actor, team);
    return this.teamViewFor(actor, team);
  }
  async getTeamInvitationPreview(actor: Actor, teamId: string) {
    this.active(actor);
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    const member = await this.teams.findMember(teamId, actor.userId);
    if (team.ownerId.toString() === actor.userId || member?.status === 'ACTIVE')
      throw new AppError('INVITATION_NOT_FOUND', 'This invitation is no longer available.', 404);
    const invitation = await this.teams.findPendingInvitation(teamId, actor.userId);
    if (!invitation || (invitation.expiresAt && invitation.expiresAt <= new Date()))
      throw new AppError(
        'INVITATION_NOT_FOUND',
        'This team invitation is no longer available.',
        404,
      );
    const owner = await this.requireUser(team.ownerId.toString());
    return {
      invitationId: invitation.id,
      status: 'PENDING' as const,
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        ...(team.goal ? { goal: team.goal } : {}),
        ...(team.category ? { category: team.category } : {}),
        tags: team.tags ?? [],
        ...(team.avatarUrl ? { avatarUrl: team.avatarUrl } : {}),
        lookingFor: team.lookingFor ?? [],
        ownerId: team.ownerId.toString(),
        status: team.status,
        ...(team.maxMembers ? { maxMembers: team.maxMembers } : {}),
        visibility: team.visibility,
        memberCount: team.memberCount,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
      },
      owner: this.userSummary(owner),
    };
  }
  async updateTeam(
    actor: Actor,
    teamId: string,
    input: Partial<{
      name: string;
      description: string;
      goal: string;
      category: string;
      tags: string[];
      avatarUrl?: string;
      deadline?: string;
      lookingFor: string[];
      status: TeamStatus;
      maxMembers: number;
      visibility: TeamVisibility;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    await this.teamOwner(actor, teamId);
    if (input.status)
      throw new AppError(
        'INVALID_TEAM_STATUS',
        'Use the lifecycle actions to change team status.',
        422,
      );
    const { deadline, ...rest } = input;
    const changes: Partial<TeamDocument> = { ...rest };
    delete changes.status;
    if (deadline) changes.deadline = new Date(deadline);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.teams.update(teamId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
      await this.record(
        'TEAM_UPDATED',
        'TEAM',
        teamId,
        actor.userId,
        correlationId,
        { teamId },
        session,
      );
      return result;
    });
    return this.teamViewFor(actor, updated);
  }
  async completeTeam(actor: Actor, teamId: string, correlationId: string) {
    const team = await this.teamOwner(actor, teamId);
    if (team.status === 'ARCHIVED')
      throw new AppError('TEAM_CLOSED', 'Archived teams cannot be completed.', 409);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.teams.update(
        teamId,
        { status: 'COMPLETED', completedAt: new Date() },
        session,
      );
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
      await this.record(
        'TEAM_COMPLETED',
        'TEAM',
        teamId,
        actor.userId,
        correlationId,
        { teamId },
        session,
      );
      return result;
    });
    return this.teamViewFor(actor, updated);
  }
  async archiveTeam(actor: Actor, teamId: string, correlationId: string) {
    await this.teamOwner(actor, teamId);
    await withMongoTransaction(async (session) => {
      const result = await this.teams.update(teamId, { status: 'ARCHIVED' }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
      await this.record(
        'TEAM_ARCHIVED',
        'TEAM',
        teamId,
        actor.userId,
        correlationId,
        { teamId },
        session,
      );
    });
  }
  async joinTeam(actor: Actor, teamId: string, correlationId: string, message?: string) {
    this.active(actor);
    const team = await this.teams.findById(teamId);
    if (!team || team.status === 'ARCHIVED')
      throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    if (!['RECRUITING', 'ACTIVE'].includes(team.status))
      throw new AppError('TEAM_CLOSED', 'This team is not accepting members.', 409);
    const existing = await this.teams.findMember(teamId, actor.userId);
    if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING')
      throw new AppError('MEMBERSHIP_EXISTS', 'A team membership already exists.', 409);
    if (team.visibility === 'PRIVATE') {
      if (await this.teams.findPendingJoinRequest(teamId, actor.userId))
        throw new AppError('REQUEST_EXISTS', 'A join request is already pending.', 409);
      const member = await withMongoTransaction(async (session) => {
        const result = await this.teams.saveMember(
          teamId,
          actor.userId,
          { role: 'MEMBER', status: 'PENDING' },
          session,
        );
        const request = await this.teams.createJoinRequest(
          {
            teamId: this.id(teamId),
            userId: this.id(actor.userId),
            status: 'PENDING',
            ...(message?.trim() ? { message: message.trim() } : {}),
          },
          session,
        );
        await this.record(
          'TEAM_JOIN_REQUESTED',
          'TEAM_JOIN_REQUEST',
          request.id,
          actor.userId,
          correlationId,
          { teamId, targetUserId: team.ownerId.toString() },
          session,
        );
        return result;
      });
      return this.teamMemberView(member);
    }
    const member = await withMongoTransaction(async (session) => {
      const reserved = await this.teams.reserveMemberSlot(teamId, team.maxMembers, session);
      if (!reserved)
        throw new AppError('TEAM_CAPACITY_REACHED', 'This team has reached capacity.', 409);
      const result = await this.teams.saveMember(
        teamId,
        actor.userId,
        { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'TEAM_MEMBER_JOINED',
        'TEAM_MEMBER',
        result.id,
        actor.userId,
        correlationId,
        { teamId, targetUserId: team.ownerId.toString() },
        session,
      );
      return result;
    });
    return this.teamMemberView(member);
  }
  async leaveTeam(actor: Actor, teamId: string, correlationId: string) {
    this.active(actor);
    const member = await this.teams.findMember(teamId, actor.userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Active team membership was not found.', 404);
    if (member.role === 'OWNER')
      throw new AppError('OWNER_CANNOT_LEAVE', 'Transfer team ownership before leaving.', 422);
    await withMongoTransaction(async (session) => {
      await this.teams.updateMember(
        teamId,
        actor.userId,
        { status: 'LEFT', leftAt: new Date() },
        session,
      );
      await this.teams.incrementMemberCount(teamId, -1, session);
      await this.record(
        'TEAM_MEMBER_LEFT',
        'TEAM_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { teamId },
        session,
      );
    });
  }
  async listTeamJoinRequests(actor: Actor, teamId: string, input: CursorInput) {
    await this.teamManager(actor, teamId);
    const requests = await this.teams.listJoinRequests(
      teamId,
      { status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      requests.map((item) => this.teamJoinRequestView(item)),
      input.limit,
    );
  }
  async reviewTeamJoinRequest(
    actor: Actor,
    teamId: string,
    requestId: string,
    approve: boolean,
    correlationId: string,
  ) {
    await this.teamManager(actor, teamId);
    const request = await this.teams.findJoinRequest(requestId);
    if (!request || request.teamId.toString() !== teamId || request.status !== 'PENDING')
      throw new AppError('REQUEST_NOT_FOUND', 'The join request is no longer pending.', 404);
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    if (approve && !['RECRUITING', 'ACTIVE'].includes(team.status))
      throw new AppError('TEAM_CLOSED', 'This team is no longer accepting members.', 409);
    await withMongoTransaction(async (session) => {
      if (approve) {
        const reserved = await this.teams.reserveMemberSlot(teamId, team.maxMembers, session);
        if (!reserved)
          throw new AppError('TEAM_CAPACITY_REACHED', 'This team has reached capacity.', 409);
      }
      await this.teams.updateJoinRequest(
        requestId,
        {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedBy: this.id(actor.userId),
          reviewedAt: new Date(),
        },
        session,
      );
      await this.teams.updateMember(
        teamId,
        request.userId.toString(),
        {
          status: approve ? 'ACTIVE' : 'LEFT',
          ...(approve ? { joinedAt: new Date() } : { leftAt: new Date() }),
        },
        session,
      );
      await this.record(
        approve ? 'TEAM_JOIN_REQUEST_APPROVED' : 'TEAM_JOIN_REQUEST_REJECTED',
        'TEAM_JOIN_REQUEST',
        request.id,
        actor.userId,
        correlationId,
        { teamId, targetUserId: request.userId.toString() },
        session,
      );
      if (approve)
        await this.record(
          'TEAM_MEMBER_JOINED',
          'TEAM_MEMBER',
          request.id,
          actor.userId,
          correlationId,
          { teamId, targetUserId: request.userId.toString() },
          session,
        );
    });
    return { status: approve ? 'APPROVED' : 'REJECTED' };
  }
  async updateTeamMemberRole(
    actor: Actor,
    teamId: string,
    userId: string,
    role: 'CO_LEAD' | 'MEMBER',
    correlationId: string,
  ) {
    this.active(actor);
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    const actorMember = await this.teamAccess(actor, team, true);
    if (!actorMember || actorMember.role !== 'OWNER')
      throw new AppError('FORBIDDEN', 'Only the team owner can change roles.', 403);
    const target = await this.teams.findMember(teamId, userId);
    if (!target || target.status !== 'ACTIVE' || target.role === 'OWNER')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'An active non-owner member is required.', 422);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.teams.updateMember(teamId, userId, { role }, session);
      if (!result) throw new AppError('MEMBERSHIP_NOT_FOUND', 'Membership was not found.', 404);
      await this.record(
        'TEAM_ROLE_CHANGED',
        'TEAM_MEMBER',
        result.id,
        actor.userId,
        correlationId,
        { teamId, targetUserId: userId, role },
        session,
      );
      return result;
    });
    return this.teamMemberView(updated);
  }
  async transferTeamOwnership(actor: Actor, teamId: string, userId: string, correlationId: string) {
    this.active(actor);
    const team = await this.teams.findById(teamId);
    if (!team || team.ownerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the team owner can transfer ownership.', 403);
    const target = await this.teams.findMember(teamId, userId);
    if (!target || target.status !== 'ACTIVE' || target.role === 'OWNER')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'An active non-owner member is required.', 422);
    const updated = await withMongoTransaction(async (session) => {
      await this.teams.updateMember(teamId, userId, { role: 'OWNER' }, session);
      await this.teams.updateMember(teamId, actor.userId, { role: 'CO_LEAD' }, session);
      const result = await this.teams.update(teamId, { ownerId: this.id(userId) }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
      await this.record(
        'TEAM_OWNERSHIP_TRANSFERRED',
        'TEAM',
        teamId,
        actor.userId,
        correlationId,
        { teamId, targetUserId: userId },
        session,
      );
      return result;
    });
    return this.teamViewFor(actor, updated);
  }
  async listTeamMembers(actor: Actor, teamId: string, input: CursorInput) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    await this.teamAccess(actor, team);
    const members = await this.teams.listMembers(
      teamId,
      { status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const users = await this.users.findByIds(members.map((item) => item.userId));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return this.page(
      members.map((item) => {
        const user = usersById.get(item.userId.toString());
        return { ...this.teamMemberView(item), ...(user ? { user: this.userSummary(user) } : {}) };
      }),
      input.limit,
    );
  }
  async inviteToTeam(actor: Actor, teamId: string, inviteeId: string, correlationId: string) {
    this.active(actor);
    const team = await this.teamManager(actor, teamId);
    if (!['RECRUITING', 'ACTIVE'].includes(team.status))
      throw new AppError('TEAM_CLOSED', 'This team is no longer accepting invitations.', 409);
    if (team.maxMembers && team.memberCount >= team.maxMembers)
      throw new AppError('TEAM_CAPACITY_REACHED', 'This team has reached capacity.', 409);
    if (inviteeId === actor.userId)
      throw new AppError('INVALID_INVITATION', 'You cannot invite yourself.', 422);
    await this.requireUser(inviteeId);
    if (await this.blocks.eitherBlocked(actor.userId, inviteeId))
      throw new AppError('FORBIDDEN', 'This invitation is not available.', 403);
    if (
      await this.teams.findMember(teamId, inviteeId).then((member) => member?.status === 'ACTIVE')
    )
      throw new AppError('MEMBERSHIP_EXISTS', 'The user is already a team member.', 409);
    if (await this.teams.findPendingInvitation(teamId, inviteeId))
      throw new AppError('INVITATION_EXISTS', 'A pending invitation already exists.', 409);
    const invitation = await withMongoTransaction(async (session) => {
      const result = await this.teams.createInvitation(
        {
          teamId: this.id(teamId),
          inviterId: this.id(actor.userId),
          inviteeId: this.id(inviteeId),
          status: 'PENDING',
        },
        session,
      );
      await this.record(
        'TEAM_INVITATION_SENT',
        'TEAM_INVITATION',
        result.id,
        actor.userId,
        correlationId,
        { teamId, targetUserId: inviteeId },
        session,
      );
      return result;
    });
    return this.invitationView(invitation);
  }
  async respondToInvitation(
    actor: Actor,
    invitationId: string,
    accepted: boolean,
    correlationId: string,
  ) {
    this.active(actor);
    const invitation = await this.teams.findInvitation(invitationId);
    if (
      !invitation ||
      invitation.inviteeId.toString() !== actor.userId ||
      invitation.status !== 'PENDING'
    )
      throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
    const team = await this.teams.findById(invitation.teamId.toString());
    if (!team || ['ARCHIVED', 'COMPLETED'].includes(team.status))
      throw new AppError('TEAM_CLOSED', 'This team is no longer available.', 409);
    if (!accepted) {
      const rejected = await this.teams.updateInvitation(invitationId, {
        status: 'REJECTED',
        respondedAt: new Date(),
      });
      if (!rejected)
        throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
      return this.invitationView(rejected);
    }
    const existingMember = await this.teams.findMember(team.id, actor.userId);
    if (existingMember?.status === 'ACTIVE')
      throw new AppError('MEMBERSHIP_EXISTS', 'You are already a team member.', 409);
    const result = await withMongoTransaction(async (session) => {
      const reserved = await this.teams.reserveMemberSlot(team.id, team.maxMembers, session);
      if (!reserved)
        throw new AppError('TEAM_CAPACITY_REACHED', 'This team has reached capacity.', 409);
      const updated = await this.teams.updateInvitation(
        invitationId,
        { status: 'ACCEPTED', respondedAt: new Date() },
        session,
      );
      if (!updated)
        throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
      const member = await this.teams.saveMember(
        team.id,
        actor.userId,
        { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'TEAM_MEMBER_JOINED',
        'TEAM_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { teamId: team.id, invitationId, targetUserId: invitation.inviterId.toString() },
        session,
      );
      return { invitation: updated, member };
    });
    return this.invitationView(result.invitation);
  }
  async listMyTeamInvitations(actor: Actor, input: CursorInput) {
    const invitations = await this.teams.listInvitations(
      { inviteeId: actor.userId, status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      await Promise.all(invitations.map((item) => this.invitationView(item))),
      input.limit,
    );
  }
  async removeTeamMember(actor: Actor, teamId: string, userId: string, correlationId: string) {
    this.active(actor);
    await this.teamManager(actor, teamId);
    if (userId === actor.userId)
      throw new AppError('INVALID_MEMBERSHIP', 'Use leave to remove yourself.', 422);
    const member = await this.teams.findMember(teamId, userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Active membership was not found.', 404);
    if (member.role === 'OWNER')
      throw new AppError('FORBIDDEN', 'The team owner cannot be removed.', 403);
    const actorMember = await this.teams.findMember(teamId, actor.userId);
    const rank = (role: TeamMemberRole) =>
      (({ MEMBER: 1, CO_LEAD: 2, OWNER: 3, ADMIN: 2 }) as Record<string, number>)[role] ?? 0;
    if (!actorMember || rank(member.role) >= rank(actorMember.role))
      throw new AppError('FORBIDDEN', 'You cannot remove an equal or higher authority.', 403);
    await withMongoTransaction(async (session) => {
      await this.teams.updateMember(
        teamId,
        userId,
        { status: 'LEFT', leftAt: new Date() },
        session,
      );
      await this.teams.incrementMemberCount(teamId, -1, session);
      await this.record(
        'TEAM_MEMBER_LEFT',
        'TEAM_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { teamId, userId },
        session,
      );
    });
  }

  async createProject(
    actor: Actor,
    input: {
      name: string;
      slug: string;
      description: string;
      objective: string;
      category: string;
      tags: string[];
      ownerTeamId?: string;
      teamId?: string;
      visibility: ProjectVisibility;
      technologies: string[];
      lookingFor: string[];
      deadline?: string;
      coverImageUrl?: string;
      repositoryUrl?: string;
      demoUrl?: string;
    },
    correlationId: string,
  ) {
    this.active(actor);
    const associatedTeamId = input.teamId ?? input.ownerTeamId;
    if (associatedTeamId) {
      const team = await this.teamManager(actor, associatedTeamId);
      if (!['ACTIVE', 'RECRUITING'].includes(team.status))
        throw new AppError('TEAM_CLOSED', 'The project team is not active.', 409);
    }
    if (await this.projects.list({ slug: input.slug }, 1).then((items) => items.length > 0))
      throw new AppError('SLUG_EXISTS', 'That project slug is already in use.', 409);
    const project = await withMongoTransaction(async (session) => {
      const created = await this.projects.create(
        {
          name: input.name,
          slug: input.slug,
          description: input.description,
          objective: input.objective,
          category: input.category,
          tags: input.tags,
          visibility: input.visibility,
          technologies: input.technologies,
          lookingFor: input.lookingFor,
          ...(associatedTeamId
            ? { teamId: this.id(associatedTeamId), ownerTeamId: this.id(associatedTeamId) }
            : {}),
          ...(input.deadline ? { deadline: new Date(input.deadline) } : {}),
          ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
          ...(input.repositoryUrl ? { repositoryUrl: input.repositoryUrl } : {}),
          ...(input.demoUrl ? { demoUrl: input.demoUrl } : {}),
          ownerId: this.id(actor.userId),
          status: 'PLANNING',
          showcaseEnabled: false,
        },
        session,
      );
      await this.projects.saveMember(
        created.id,
        actor.userId,
        { role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_CREATED',
        'PROJECT',
        created.id,
        actor.userId,
        correlationId,
        { projectId: created.id },
        session,
      );
      return created;
    });
    return this.projectViewFor(actor, project);
  }
  async listProjects(
    actor: Actor,
    input: CursorInput & { search?: string; category?: string; tags?: string; status?: string },
  ) {
    const search = input.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = input.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const items = await this.projects.list(
      {
        status: input.status ?? { $in: ['PLANNING', 'ACTIVE', 'COMPLETED'] },
        ...(input.category ? { category: input.category } : {}),
        ...(tags?.length ? { tags: { $in: tags.map((tag) => new RegExp(`^${tag}$`, 'i')) } } : {}),
        ...(search
          ? {
              $or: [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
                { objective: new RegExp(search, 'i') },
                { tags: new RegExp(search, 'i') },
                { technologies: new RegExp(search, 'i') },
              ],
            }
          : {}),
        ...this.cursorFilter(input.cursor),
      },
      input.limit + 1,
    );
    const visible = [];
    for (const project of items) {
      if (
        ['PUBLIC', 'CAMPUS', 'CONNECTIONS'].includes(project.visibility) ||
        project.ownerId.toString() === actor.userId ||
        (await this.projects
          .findMember(project.id, actor.userId)
          .then((member) => member?.status === 'ACTIVE'))
      )
        visible.push(await this.projectViewFor(actor, project));
      if (visible.length === input.limit) break;
    }
    return this.page(visible, input.limit);
  }
  async getProject(actor: Actor, projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    await this.projectAccess(actor, project);
    return this.projectViewFor(actor, project);
  }
  async updateProject(
    actor: Actor,
    projectId: string,
    input: Partial<{
      name: string;
      description: string;
      objective: string;
      category: string;
      tags: string[];
      visibility: ProjectVisibility;
      technologies: string[];
      lookingFor: string[];
      deadline?: string;
      coverImageUrl?: string;
      repositoryUrl: string;
      demoUrl: string;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    const { deadline, ...rest } = input;
    const changes: Partial<ProjectDocument> = {
      ...rest,
      ...(deadline ? { deadline: new Date(deadline) } : {}),
    };
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.update(projectId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_UPDATED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
      return result;
    });
    return this.projectViewFor(actor, updated);
  }
  async completeProject(actor: Actor, projectId: string, correlationId: string) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    const project = await withMongoTransaction(async (session) => {
      const result = await this.projects.update(
        projectId,
        { status: 'COMPLETED', completedAt: new Date() },
        session,
      );
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_COMPLETED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
      return result;
    });
    return this.projectViewFor(actor, project);
  }
  async activateProject(actor: Actor, projectId: string, correlationId: string) {
    this.active(actor);
    const current = await this.projectManager(actor, projectId);
    if (current.status !== 'PLANNING')
      throw new AppError(
        'INVALID_PROJECT_TRANSITION',
        'Only planning projects can be activated.',
        409,
      );
    const project = await withMongoTransaction(async (session) => {
      const result = await this.projects.update(projectId, { status: 'ACTIVE' }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_ACTIVATED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
      return result;
    });
    return this.projectViewFor(actor, project);
  }
  async showcaseProject(actor: Actor, projectId: string, correlationId: string) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    const project = await withMongoTransaction(async (session) => {
      const result = await this.projects.update(projectId, { showcaseEnabled: true }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_SHOWCASED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
      return result;
    });
    return this.projectViewFor(actor, project);
  }
  async archiveProject(actor: Actor, projectId: string, correlationId: string) {
    this.active(actor);
    await this.projectOwner(actor, projectId, true);
    await withMongoTransaction(async (session) => {
      const result = await this.projects.update(projectId, { status: 'ARCHIVED' }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_ARCHIVED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId, status: 'ARCHIVED' },
        session,
      );
    });
  }
  async joinProject(actor: Actor, projectId: string, correlationId: string, message?: string) {
    this.active(actor);
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    if (['COMPLETED', 'ARCHIVED'].includes(project.status))
      throw new AppError(
        'PROJECT_CLOSED',
        'This project is no longer accepting collaborators.',
        409,
      );
    const existing = await this.projects.findMember(projectId, actor.userId);
    if (existing?.status === 'ACTIVE' || existing?.status === 'PENDING')
      throw new AppError('MEMBERSHIP_EXISTS', 'A project membership already exists.', 409);
    if (project.visibility === 'PRIVATE') {
      if (await this.projects.findPendingJoinRequest(projectId, actor.userId))
        throw new AppError('REQUEST_EXISTS', 'A join request is already pending.', 409);
      const member = await withMongoTransaction(async (session) => {
        await this.projects.saveMember(
          projectId,
          actor.userId,
          { role: 'COLLABORATOR', status: 'PENDING' },
          session,
        );
        const request = await this.projects.createJoinRequest(
          {
            projectId: this.id(projectId),
            userId: this.id(actor.userId),
            status: 'PENDING',
            ...(message?.trim() ? { message: message.trim() } : {}),
          },
          session,
        );
        await this.record(
          'PROJECT_JOIN_REQUESTED',
          'PROJECT_JOIN_REQUEST',
          request.id,
          actor.userId,
          correlationId,
          { projectId, targetUserId: project.ownerId.toString() },
          session,
        );
        return request;
      });
      return this.projectJoinRequestView(member);
    }
    const member = await withMongoTransaction(async (session) => {
      const result = await this.projects.saveMember(
        projectId,
        actor.userId,
        { role: 'COLLABORATOR', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_MEMBER_ADDED',
        'PROJECT_MEMBER',
        result.id,
        actor.userId,
        correlationId,
        { projectId, targetUserId: project.ownerId.toString(), userId: actor.userId },
        session,
      );
      return result;
    });
    return this.projectMemberView(member);
  }
  async listProjectJoinRequests(actor: Actor, projectId: string, input: CursorInput) {
    await this.projectManager(actor, projectId);
    const requests = await this.projects.listJoinRequests(
      projectId,
      { status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      requests.map((item) => this.projectJoinRequestView(item)),
      input.limit,
    );
  }
  async reviewProjectJoinRequest(
    actor: Actor,
    projectId: string,
    requestId: string,
    approve: boolean,
    correlationId: string,
  ) {
    await this.projectManager(actor, projectId);
    const request = await this.projects.findJoinRequest(requestId);
    if (!request || request.projectId.toString() !== projectId || request.status !== 'PENDING')
      throw new AppError('REQUEST_NOT_FOUND', 'The join request is no longer pending.', 404);
    const result = await withMongoTransaction(async (session) => {
      await this.projects.updateJoinRequest(
        requestId,
        {
          status: approve ? 'APPROVED' : 'REJECTED',
          reviewedBy: this.id(actor.userId),
          reviewedAt: new Date(),
        },
        session,
      );
      await this.projects.updateMember(
        projectId,
        request.userId.toString(),
        {
          status: approve ? 'ACTIVE' : 'LEFT',
          ...(approve ? { joinedAt: new Date() } : { leftAt: new Date() }),
        },
        session,
      );
      await this.record(
        approve ? 'PROJECT_JOIN_REQUEST_APPROVED' : 'PROJECT_JOIN_REQUEST_REJECTED',
        'PROJECT_JOIN_REQUEST',
        request.id,
        actor.userId,
        correlationId,
        { projectId, targetUserId: request.userId.toString() },
        session,
      );
      if (approve)
        await this.record(
          'PROJECT_MEMBER_ADDED',
          'PROJECT_MEMBER',
          request.id,
          actor.userId,
          correlationId,
          { projectId, targetUserId: request.userId.toString(), userId: request.userId.toString() },
          session,
        );
      return request;
    });
    return { status: approve ? 'APPROVED' : 'REJECTED', requestId: result.id };
  }
  async inviteToProject(actor: Actor, projectId: string, inviteeId: string, correlationId: string) {
    this.active(actor);
    const project = await this.projectManager(actor, projectId);
    if (
      project.visibility === 'PRIVATE' ||
      ['COMPLETED', 'ARCHIVED'].includes(project.status) === true
    ) {
      if (['COMPLETED', 'ARCHIVED'].includes(project.status))
        throw new AppError(
          'PROJECT_CLOSED',
          'This project is no longer accepting invitations.',
          409,
        );
    }
    if (inviteeId === actor.userId)
      throw new AppError('INVALID_INVITATION', 'You cannot invite yourself.', 422);
    await this.requireUser(inviteeId);
    if (await this.blocks.eitherBlocked(actor.userId, inviteeId))
      throw new AppError('FORBIDDEN', 'This project interaction is not available.', 403);
    const member = await this.projects.findMember(projectId, inviteeId);
    if (member?.status === 'ACTIVE')
      throw new AppError('MEMBERSHIP_EXISTS', 'The user is already a project collaborator.', 409);
    if (await this.projects.findPendingInvitation(projectId, inviteeId))
      throw new AppError('INVITATION_EXISTS', 'A pending invitation already exists.', 409);
    const invitation = await withMongoTransaction(async (session) => {
      const result = await this.projects.createInvitation(
        {
          projectId: this.id(projectId),
          inviterId: this.id(actor.userId),
          inviteeId: this.id(inviteeId),
          status: 'PENDING',
        },
        session,
      );
      await this.record(
        'PROJECT_INVITATION_SENT',
        'PROJECT_INVITATION',
        result.id,
        actor.userId,
        correlationId,
        { projectId, targetUserId: inviteeId },
        session,
      );
      return result;
    });
    return this.projectInvitationView(invitation);
  }
  async respondToProjectInvitation(
    actor: Actor,
    invitationId: string,
    accepted: boolean,
    correlationId: string,
  ) {
    this.active(actor);
    const invitation = await this.projects.findInvitation(invitationId);
    if (
      !invitation ||
      invitation.inviteeId.toString() !== actor.userId ||
      invitation.status !== 'PENDING'
    )
      throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
    const project = await this.projects.findById(invitation.projectId.toString());
    if (!project || ['COMPLETED', 'ARCHIVED'].includes(project.status))
      throw new AppError('PROJECT_CLOSED', 'This project is no longer available.', 409);
    if (!accepted) {
      const declined = await this.projects.updateInvitation(invitationId, {
        status: 'DECLINED',
        respondedAt: new Date(),
      });
      if (!declined)
        throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
      return this.projectInvitationView(declined);
    }
    const existing = await this.projects.findMember(project.id, actor.userId);
    if (existing?.status === 'ACTIVE')
      throw new AppError('MEMBERSHIP_EXISTS', 'You are already a project collaborator.', 409);
    const result = await withMongoTransaction(async (session) => {
      const updated = await this.projects.updateInvitation(
        invitationId,
        { status: 'ACCEPTED', respondedAt: new Date() },
        session,
      );
      if (!updated)
        throw new AppError('INVITATION_NOT_FOUND', 'The invitation was not found.', 404);
      const member = await this.projects.saveMember(
        project.id,
        actor.userId,
        { role: 'COLLABORATOR', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_MEMBER_ADDED',
        'PROJECT_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        {
          projectId: project.id,
          targetUserId: invitation.inviterId.toString(),
          userId: actor.userId,
        },
        session,
      );
      return updated;
    });
    return this.projectInvitationView(result);
  }
  async listMyProjectInvitations(actor: Actor, input: CursorInput) {
    const invitations = await this.projects.listInvitations(
      { inviteeId: actor.userId, status: 'PENDING', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      await Promise.all(invitations.map((item) => this.projectInvitationView(item))),
      input.limit,
    );
  }
  async listProjectInvitations(actor: Actor, projectId: string, input: CursorInput) {
    await this.projectManager(actor, projectId);
    const invitations = await this.projects.listInvitations(
      { projectId, ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      await Promise.all(invitations.map((item) => this.projectInvitationView(item))),
      input.limit,
    );
  }
  async transferProjectOwnership(
    actor: Actor,
    projectId: string,
    userId: string,
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectOwner(actor, projectId);
    const target = await this.projects.findMember(projectId, userId);
    if (!target || target.status !== 'ACTIVE' || target.role === 'OWNER')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'An active collaborator is required.', 422);
    const updated = await withMongoTransaction(async (session) => {
      await this.projects.updateMember(projectId, userId, { role: 'OWNER' }, session);
      await this.projects.updateMember(projectId, actor.userId, { role: 'COLLABORATOR' }, session);
      const result = await this.projects.update(projectId, { ownerId: this.id(userId) }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
      await this.record(
        'PROJECT_OWNERSHIP_TRANSFERRED',
        'PROJECT',
        projectId,
        actor.userId,
        correlationId,
        { projectId, targetUserId: userId },
        session,
      );
      return result;
    });
    return this.projectViewFor(actor, updated);
  }
  async addProjectMember(
    actor: Actor,
    projectId: string,
    userId: string,
    role: ProjectMemberRole = 'COLLABORATOR',
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    void role;
    await this.requireUser(userId);
    if (await this.blocks.eitherBlocked(actor.userId, userId))
      throw new AppError('FORBIDDEN', 'This project interaction is not available.', 403);
    const member = await withMongoTransaction(async (session) => {
      const result = await this.projects.saveMember(
        projectId,
        userId,
        { role: 'COLLABORATOR', status: 'ACTIVE', joinedAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_MEMBER_ADDED',
        'PROJECT_MEMBER',
        result.id,
        actor.userId,
        correlationId,
        { projectId, userId },
        session,
      );
      return result;
    });
    return this.projectMemberView(member);
  }
  async removeProjectMember(
    actor: Actor,
    projectId: string,
    userId: string,
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    const member = await this.projects.findMember(projectId, userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Active project membership was not found.', 404);
    if (member.role === 'OWNER')
      throw new AppError('INVALID_MEMBERSHIP', 'The project owner cannot be removed.', 422);
    await withMongoTransaction(async (session) => {
      await this.projects.updateMember(
        projectId,
        userId,
        { status: 'LEFT', leftAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_MEMBER_REMOVED',
        'PROJECT_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { projectId, userId },
        session,
      );
    });
  }
  async leaveProject(actor: Actor, projectId: string, correlationId: string) {
    this.active(actor);
    const member = await this.projects.findMember(projectId, actor.userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('MEMBERSHIP_NOT_FOUND', 'Active project membership was not found.', 404);
    if (member.role === 'OWNER')
      throw new AppError('OWNER_CANNOT_LEAVE', 'Transfer project ownership before leaving.', 422);
    await withMongoTransaction(async (session) => {
      await this.projects.updateMember(
        projectId,
        actor.userId,
        { status: 'LEFT', leftAt: new Date() },
        session,
      );
      await this.record(
        'PROJECT_MEMBER_REMOVED',
        'PROJECT_MEMBER',
        member.id,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
    });
  }
  async listProjectMembers(actor: Actor, projectId: string, input: CursorInput) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    await this.projectAccess(actor, project);
    const members = await this.projects.listMembers(
      projectId,
      { status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const users = await this.users.findByIds(members.map((item) => item.userId));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return this.page(
      members.map((item) => {
        const user = usersById.get(item.userId.toString());
        return {
          ...this.projectMemberView(item),
          ...(user ? { user: this.userSummary(user) } : {}),
        };
      }),
      input.limit,
    );
  }

  private async activeProjectMember(actor: Actor, projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projectAccess(actor, project, true);
    if (!member) throw new AppError('FORBIDDEN', 'Project membership is required.', 403);
    return project;
  }
  private async projectMemberAccess(actor: Actor, projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projectAccess(actor, project, false);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('FORBIDDEN', 'Project membership is required.', 403);
    return project;
  }
  private validTaskTransition(from: TaskStatus, to: TaskStatus) {
    const allowed: Record<TaskStatus, TaskStatus[]> = {
      TODO: ['IN_PROGRESS'],
      IN_PROGRESS: ['DONE'],
      DONE: [],
    };
    if (from !== to && !allowed[from].includes(to))
      throw new AppError(
        'INVALID_TASK_TRANSITION',
        'That task status transition is not allowed.',
        422,
      );
  }
  async createTask(
    actor: Actor,
    projectId: string,
    input: {
      title: string;
      description: string;
      priority: TaskPriority;
      assigneeId?: string;
      dueDate?: string;
    },
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    if (input.assigneeId) {
      const member = await this.projects.findMember(projectId, input.assigneeId);
      if (!member || member.status !== 'ACTIVE')
        throw new AppError(
          'INVALID_ASSIGNEE',
          'The assignee must be an active project member.',
          422,
        );
    }
    const task = await withMongoTransaction(async (session) => {
      const created = await this.projects.createTask(
        {
          projectId: this.id(projectId),
          title: input.title,
          description: input.description,
          creatorId: this.id(actor.userId),
          priority: input.priority,
          status: 'TODO',
          ...(input.assigneeId ? { assigneeId: this.id(input.assigneeId) } : {}),
          ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
        },
        session,
      );
      await this.record(
        'TASK_CREATED',
        'TASK',
        created.id,
        actor.userId,
        correlationId,
        { projectId, taskId: created.id },
        session,
      );
      return created;
    });
    return this.taskView(task);
  }
  async listTasks(actor: Actor, projectId: string, input: CursorInput) {
    await this.projectMemberAccess(actor, projectId);
    const tasks = await this.projects.listTasks(
      projectId,
      { archivedAt: { $exists: false }, ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    return this.page(
      tasks.map((item) => this.taskView(item)),
      input.limit,
    );
  }
  async updateTask(
    actor: Actor,
    taskId: string,
    input: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      dueDate: string;
      status: TaskStatus;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    const task = await this.projects.findTask(taskId);
    if (!task) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
    const project = await this.projects.findById(task.projectId.toString());
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projectAccess(actor, project, true);
    if (
      !member ||
      (member.role !== 'OWNER' &&
        task.creatorId.toString() !== actor.userId &&
        task.assigneeId?.toString() !== actor.userId)
    )
      throw new AppError('FORBIDDEN', 'You cannot update this task.', 403);
    const changes: Partial<TaskDocument> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.priority !== undefined) changes.priority = input.priority;
    if (input.dueDate) changes.dueDate = new Date(input.dueDate);
    if (input.status !== undefined) {
      this.validTaskTransition(task.status, input.status);
      changes.status = input.status;
      if (input.status === 'DONE') changes.completedAt = new Date();
    }
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.updateTask(taskId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
      await this.record(
        'TASK_UPDATED',
        'TASK',
        taskId,
        actor.userId,
        correlationId,
        { taskId },
        session,
      );
      return result;
    });
    return this.taskView(updated);
  }
  async assignTask(actor: Actor, taskId: string, assigneeId: string, correlationId: string) {
    this.active(actor);
    const task = await this.projects.findTask(taskId);
    if (!task) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
    await this.projectManager(actor, task.projectId.toString());
    const member = await this.projects.findMember(task.projectId.toString(), assigneeId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError('INVALID_ASSIGNEE', 'The assignee must be an active project member.', 422);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.updateTask(
        taskId,
        { assigneeId: this.id(assigneeId) },
        session,
      );
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
      await this.record(
        'TASK_ASSIGNED',
        'TASK',
        taskId,
        actor.userId,
        correlationId,
        { taskId, assigneeId },
        session,
      );
      return result;
    });
    return this.taskView(updated);
  }
  async changeTaskStatus(actor: Actor, taskId: string, status: TaskStatus, correlationId: string) {
    this.active(actor);
    const task = await this.projects.findTask(taskId);
    if (!task) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
    const project = await this.projects.findById(task.projectId.toString());
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    const member = await this.projectAccess(actor, project, true);
    if (!member || (member.role !== 'OWNER' && task.assigneeId?.toString() !== actor.userId))
      throw new AppError('FORBIDDEN', 'You cannot change this task status.', 403);
    this.validTaskTransition(task.status, status);
    const changes: Partial<TaskDocument> = { status };
    if (status === 'DONE') changes.completedAt = new Date();
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.updateTask(taskId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
      await this.record(
        'TASK_STATUS_CHANGED',
        'TASK',
        taskId,
        actor.userId,
        correlationId,
        { taskId, from: task.status, to: status },
        session,
      );
      if (status === 'DONE')
        await this.record(
          'TASK_COMPLETED',
          'TASK',
          taskId,
          actor.userId,
          correlationId,
          { taskId },
          session,
        );
      return result;
    });
    return this.taskView(updated);
  }
  async archiveTask(actor: Actor, taskId: string, correlationId: string) {
    this.active(actor);
    const task = await this.projects.findTask(taskId);
    if (!task) throw new AppError('RESOURCE_NOT_FOUND', 'The task was not found.', 404);
    await this.projectManager(actor, task.projectId.toString());
    await withMongoTransaction(async (session) => {
      await this.projects.updateTask(
        taskId,
        { archivedAt: new Date(), archivedBy: this.id(actor.userId) } as Partial<TaskDocument>,
        session,
      );
      await this.record(
        'TASK_UPDATED',
        'TASK',
        taskId,
        actor.userId,
        correlationId,
        { taskId, status: 'ARCHIVED' },
        session,
      );
    });
  }
  async createMilestone(
    actor: Actor,
    projectId: string,
    input: { title: string; description: string; dueDate?: string; order: number },
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectManager(actor, projectId);
    const milestone = await withMongoTransaction(async (session) => {
      const created = await this.projects.createMilestone(
        {
          projectId: this.id(projectId),
          title: input.title,
          description: input.description,
          order: input.order,
          status: 'UPCOMING',
          createdBy: this.id(actor.userId),
          ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
        },
        session,
      );
      await this.record(
        'MILESTONE_CREATED',
        'MILESTONE',
        created.id,
        actor.userId,
        correlationId,
        { projectId, milestoneId: created.id },
        session,
      );
      return created;
    });
    return this.milestoneView(milestone);
  }
  async listMilestones(actor: Actor, projectId: string) {
    await this.projectMemberAccess(actor, projectId);
    const items = await this.projects.listMilestones(projectId, 100);
    return {
      data: items.map((item) => this.milestoneView(item)),
      pagination: { hasMore: false, nextCursor: null },
    };
  }
  async updateMilestone(
    actor: Actor,
    milestoneId: string,
    input: Partial<{
      title: string;
      description: string;
      dueDate: string;
      order: number;
      status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    const milestone = await this.projects.findMilestone(milestoneId);
    if (!milestone) throw new AppError('RESOURCE_NOT_FOUND', 'The milestone was not found.', 404);
    await this.projectManager(actor, milestone.projectId.toString());
    const changes: Partial<MilestoneDocument> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.order !== undefined) changes.order = input.order;
    if (input.status !== undefined) changes.status = input.status;
    if (input.dueDate) changes.dueDate = new Date(input.dueDate);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.updateMilestone(milestoneId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The milestone was not found.', 404);
      await this.record(
        input.status === 'COMPLETED' ? 'MILESTONE_COMPLETED' : 'MILESTONE_UPDATED',
        'MILESTONE',
        milestoneId,
        actor.userId,
        correlationId,
        { milestoneId },
        session,
      );
      return result;
    });
    return this.milestoneView(updated);
  }
  async deleteMilestone(actor: Actor, milestoneId: string, correlationId: string) {
    this.active(actor);
    const milestone = await this.projects.findMilestone(milestoneId);
    if (!milestone) throw new AppError('RESOURCE_NOT_FOUND', 'The milestone was not found.', 404);
    await this.projectManager(actor, milestone.projectId.toString());
    await withMongoTransaction(async (session) => {
      await this.projects.deleteMilestone(milestoneId, session);
      await this.record(
        'MILESTONE_UPDATED',
        'MILESTONE',
        milestoneId,
        actor.userId,
        correlationId,
        { milestoneId, status: 'DELETED' },
        session,
      );
    });
  }
  async createProjectResource(
    actor: Actor,
    projectId: string,
    input: { title: string; url: string; type: ProjectResourceType },
    correlationId: string,
  ) {
    this.active(actor);
    await this.projectAccess(actor, await this.requireProject(projectId), true);
    const resource = await withMongoTransaction(async (session) => {
      const created = await this.projects.createResource(
        {
          projectId: this.id(projectId),
          title: input.title,
          url: input.url,
          type: input.type,
          createdBy: this.id(actor.userId),
        },
        session,
      );
      await this.record(
        'PROJECT_RESOURCE_ADDED',
        'PROJECT_RESOURCE',
        created.id,
        actor.userId,
        correlationId,
        { projectId, resourceId: created.id },
        session,
      );
      await this.projects.createActivity(
        {
          projectId: this.id(projectId),
          actorId: this.id(actor.userId),
          type: 'RESOURCE_ADDED',
          message: `Added resource "${input.title}".`,
          metadata: { resourceId: created.id },
        },
        session,
      );
      return created;
    });
    return this.projectResourceView(resource);
  }
  async listProjectResources(actor: Actor, projectId: string) {
    await this.projectAccess(actor, await this.requireProject(projectId));
    const resources = await this.projects.listResources(projectId, 100);
    return {
      data: resources.map((item) => this.projectResourceView(item)),
      pagination: { hasMore: false, nextCursor: null },
    };
  }
  async updateProjectResource(
    actor: Actor,
    resourceId: string,
    input: Partial<{ title: string; url: string; type: ProjectResourceType }>,
    correlationId: string,
  ) {
    this.active(actor);
    const resource = await this.projects.findResource(resourceId);
    if (!resource) throw new AppError('RESOURCE_NOT_FOUND', 'The resource was not found.', 404);
    const project = await this.requireProject(resource.projectId.toString());
    const member = await this.projectAccess(actor, project, true);
    if (!member || (member.role !== 'OWNER' && resource.createdBy.toString() !== actor.userId))
      throw new AppError('FORBIDDEN', 'You cannot update this resource.', 403);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.projects.updateResource(resourceId, input, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The resource was not found.', 404);
      await this.record(
        'PROJECT_RESOURCE_UPDATED',
        'PROJECT_RESOURCE',
        resourceId,
        actor.userId,
        correlationId,
        { projectId: resource.projectId.toString(), resourceId },
        session,
      );
      return result;
    });
    return this.projectResourceView(updated);
  }
  async deleteProjectResource(actor: Actor, resourceId: string, correlationId: string) {
    this.active(actor);
    const resource = await this.projects.findResource(resourceId);
    if (!resource) throw new AppError('RESOURCE_NOT_FOUND', 'The resource was not found.', 404);
    const project = await this.requireProject(resource.projectId.toString());
    const member = await this.projectAccess(actor, project, true);
    if (!member || (member.role !== 'OWNER' && resource.createdBy.toString() !== actor.userId))
      throw new AppError('FORBIDDEN', 'You cannot delete this resource.', 403);
    await withMongoTransaction(async (session) => {
      await this.projects.deleteResource(resourceId, session);
      await this.record(
        'PROJECT_RESOURCE_REMOVED',
        'PROJECT_RESOURCE',
        resourceId,
        actor.userId,
        correlationId,
        { projectId: resource.projectId.toString(), resourceId },
        session,
      );
    });
  }
  async postProjectUpdate(actor: Actor, projectId: string, message: string, correlationId: string) {
    this.active(actor);
    await this.projectMemberAccess(actor, projectId);
    const activity = await withMongoTransaction(async (session) => {
      const created = await this.projects.createActivity(
        {
          projectId: this.id(projectId),
          actorId: this.id(actor.userId),
          type: 'PROJECT_UPDATE',
          message,
        },
        session,
      );
      await this.record(
        'PROJECT_UPDATE_POSTED',
        'PROJECT_ACTIVITY',
        created.id,
        actor.userId,
        correlationId,
        { projectId },
        session,
      );
      return created;
    });
    return this.projectActivityView(activity);
  }
  async listProjectActivity(actor: Actor, projectId: string) {
    await this.projectAccess(actor, await this.requireProject(projectId));
    const items = await this.projects.listActivity(projectId, 100);
    return {
      data: items.map((item) => this.projectActivityView(item)),
      pagination: { hasMore: false, nextCursor: null },
    };
  }
  private eventStatus(item: EventDocument): EventStatus {
    if (item.status === 'CANCELLED' || item.status === 'ARCHIVED') return item.status;
    const now = Date.now();
    if (now < item.startAt.valueOf()) return 'UPCOMING';
    if (now < item.endAt.valueOf()) return 'ONGOING';
    return 'COMPLETED';
  }
  private async eventAccessible(actor: Actor, item: EventDocument) {
    if (item.organizerId.toString() === actor.userId || item.visibility !== 'PRIVATE') return true;
    const registration = await this.eventRecords.findRegistration(item.id, actor.userId);
    return registration ? ['REGISTERED', 'ATTENDED'].includes(registration.status) : false;
  }
  private async eventAccess(actor: Actor, item: EventDocument) {
    const registration = await this.eventRecords.findRegistration(item.id, actor.userId);
    const isOrganizer = item.organizerId.toString() === actor.userId;
    const isPrivateParticipant = ['REGISTERED', 'ATTENDED'].includes(registration?.status ?? '');
    if (!isOrganizer && item.visibility === 'PRIVATE' && !isPrivateParticipant) {
      throw new AppError('FORBIDDEN', 'You cannot access this private event.', 403);
    }
    return registration;
  }
  private async eventViewFor(
    actor: Actor,
    item: EventDocument,
    registration?: EventRegistrationDocument | null,
  ) {
    const currentRegistration =
      registration === undefined
        ? await this.eventRecords.findRegistration(item.id, actor.userId)
        : registration;
    const organizer = await this.users.findById(item.organizerId.toString());
    const status = this.eventStatus(item);
    const full = item.capacity !== undefined && item.registrationCount >= item.capacity;
    const registrationClosed = Boolean(
      item.registrationDeadline && item.registrationDeadline.valueOf() <= Date.now(),
    );
    const isRegistered = ['REGISTERED', 'ATTENDED'].includes(currentRegistration?.status ?? '');
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      organizerId: item.organizerId.toString(),
      ...(organizer ? { organizer: this.userSummary(organizer) } : {}),
      category: item.category,
      tags: item.tags ?? [],
      ...(item.coverImageUrl ? { coverImageUrl: item.coverImageUrl } : {}),
      ...(item.venue ? { venue: item.venue } : {}),
      mode: item.mode,
      ...(item.meetingLink ? { meetingLink: item.meetingLink } : {}),
      startAt: item.startAt.toISOString(),
      endAt: item.endAt.toISOString(),
      ...(item.registrationDeadline
        ? { registrationDeadline: item.registrationDeadline.toISOString() }
        : {}),
      ...(item.capacity !== undefined
        ? {
            capacity: item.capacity,
            availableSeats: Math.max(0, item.capacity - item.registrationCount),
          }
        : {}),
      registrationCount: item.registrationCount,
      visibility: item.visibility,
      status,
      registrationRequired: item.registrationRequired,
      rules: item.rules ?? [],
      ...(item.teamId ? { teamId: item.teamId.toString() } : {}),
      ...(item.communityId ? { communityId: item.communityId.toString() } : {}),
      ...(currentRegistration ? { registrationStatus: currentRegistration.status } : {}),
      isRegistered,
      canRegister:
        item.registrationRequired &&
        !isRegistered &&
        !full &&
        !registrationClosed &&
        ['UPCOMING', 'ONGOING'].includes(status) &&
        item.organizerId.toString() !== actor.userId,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private eventRegistrationView(item: EventRegistrationDocument, user?: UserDocument) {
    return {
      id: item.id,
      eventId: item.eventId.toString(),
      userId: item.userId.toString(),
      status: item.status,
      registeredAt: item.registeredAt.toISOString(),
      ...(item.cancelledAt ? { cancelledAt: item.cancelledAt.toISOString() } : {}),
      ...(user ? { user: this.userSummary(user) } : {}),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private eventCursorFilter(cursor?: string) {
    if (!cursor) return {};
    try {
      const value = decodeCursor(cursor);
      if (!Types.ObjectId.isValid(value.id)) throw new Error();
      const date = new Date(value.createdAt);
      if (Number.isNaN(date.valueOf())) throw new Error();
      return {
        $or: [{ startAt: { $gt: date } }, { startAt: date, _id: { $gt: this.id(value.id) } }],
      };
    } catch {
      throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
    }
  }
  private eventPage<T extends { id: string; startAt: string }>(
    items: T[],
    limit: number,
  ): ApiCollection<T> {
    const data = items.slice(0, limit);
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        hasMore: items.length > limit,
        nextCursor:
          items.length > limit && last
            ? encodeCursor({ createdAt: last.startAt, id: last.id })
            : null,
      },
    };
  }
  async createEvent(
    actor: Actor,
    input: {
      title: string;
      description: string;
      category: string;
      tags: string[];
      coverImageUrl?: string;
      venue?: string;
      mode: EventMode;
      meetingLink?: string;
      startAt: string;
      endAt: string;
      registrationDeadline?: string;
      capacity?: number;
      registrationRequired: boolean;
      visibility: EventVisibility;
      rules: string[];
      teamId?: string;
      communityId?: string;
    },
    correlationId: string,
  ) {
    this.active(actor);
    const start = new Date(input.startAt);
    const end = new Date(input.endAt);
    if (end <= start)
      throw new AppError('INVALID_EVENT_TIME', 'Event end time must be after the start time.', 422);
    if (start <= new Date())
      throw new AppError('INVALID_EVENT_TIME', 'Events must start in the future.', 422);
    if (input.registrationDeadline && new Date(input.registrationDeadline) >= start)
      throw new AppError(
        'INVALID_REGISTRATION_DEADLINE',
        'Registration must close before the event starts.',
        422,
      );
    if ((input.mode === 'OFFLINE' || input.mode === 'HYBRID') && !input.venue?.trim())
      throw new AppError('VENUE_REQUIRED', 'Venue is required for offline or hybrid events.', 422);
    if ((input.mode === 'ONLINE' || input.mode === 'HYBRID') && !input.meetingLink?.trim())
      throw new AppError(
        'MEETING_LINK_REQUIRED',
        'Meeting link is required for online or hybrid events.',
        422,
      );
    const event = await withMongoTransaction(async (session) => {
      const created = await this.eventRecords.create(
        {
          title: input.title,
          description: input.description,
          category: input.category,
          tags: input.tags,
          mode: input.mode,
          visibility: input.visibility,
          registrationRequired: input.registrationRequired,
          rules: input.rules,
          organizerId: this.id(actor.userId),
          ...(input.coverImageUrl ? { coverImageUrl: input.coverImageUrl } : {}),
          ...(input.venue ? { venue: input.venue } : {}),
          ...(input.meetingLink ? { meetingLink: input.meetingLink } : {}),
          startAt: start,
          endAt: end,
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.teamId ? { teamId: this.id(input.teamId) } : {}),
          ...(input.communityId ? { communityId: this.id(input.communityId) } : {}),
          ...(input.registrationDeadline
            ? { registrationDeadline: new Date(input.registrationDeadline) }
            : {}),
          status: 'UPCOMING',
          registrationCount: 0,
        },
        session,
      );
      await this.record(
        'EVENT_CREATED',
        'EVENT',
        created.id,
        actor.userId,
        correlationId,
        { eventId: created.id },
        session,
      );
      return created;
    });
    return this.eventViewFor(actor, event);
  }
  async listEvents(
    actor: Actor,
    input: CursorInput & {
      search?: string;
      category?: string;
      tags?: string;
      status?: EventStatus;
      mode?: EventMode;
      from?: string;
      to?: string;
      available?: boolean;
    },
  ) {
    const search = input.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tags = input.tags
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const items = await this.eventRecords.list(
      {
        status: input.status === 'ARCHIVED' ? 'ARCHIVED' : { $ne: 'ARCHIVED' },
        ...(input.category ? { category: input.category } : {}),
        ...(input.mode ? { mode: input.mode } : {}),
        ...(tags?.length ? { tags: { $in: tags.map((tag) => new RegExp(`^${tag}$`, 'i')) } } : {}),
        ...(input.from ? { startAt: { $gte: new Date(input.from) } } : {}),
        ...(input.to ? { endAt: { $lte: new Date(input.to) } } : {}),
        ...(search
          ? {
              $or: [
                { title: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
                { category: new RegExp(search, 'i') },
                { tags: new RegExp(search, 'i') },
              ],
            }
          : {}),
        ...this.eventCursorFilter(input.cursor),
      },
      input.limit + 1,
    );
    const visible: Array<Awaited<ReturnType<typeof this.eventViewFor>> & { startAt: string }> = [];
    for (const item of items) {
      if (!(await this.eventAccessible(actor, item))) continue;
      const view = await this.eventViewFor(actor, item);
      if (input.status && view.status !== input.status) continue;
      if (input.available && view.capacity !== undefined && (view.availableSeats ?? 0) <= 0)
        continue;
      visible.push(view);
      if (visible.length >= input.limit) break;
    }
    return this.eventPage(visible, input.limit);
  }
  async getEvent(actor: Actor, eventId: string) {
    const event = await this.eventRecords.findById(eventId);
    if (!event) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    const registration = await this.eventAccess(actor, event);
    return this.eventViewFor(actor, event, registration);
  }
  async updateEvent(
    actor: Actor,
    eventId: string,
    input: Partial<{
      title: string;
      description: string;
      category: string;
      tags: string[];
      coverImageUrl?: string;
      venue?: string;
      mode: EventMode;
      meetingLink?: string;
      startAt: string;
      endAt: string;
      registrationDeadline?: string;
      capacity?: number;
      registrationRequired: boolean;
      visibility: EventVisibility;
      rules: string[];
      teamId?: string;
      communityId?: string;
    }>,
    correlationId: string,
  ) {
    this.active(actor);
    const current = await this.eventRecords.findById(eventId);
    if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    if (current.organizerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the event organizer can edit this event.', 403);
    if (['CANCELLED', 'ARCHIVED'].includes(current.status))
      throw new AppError('EVENT_CLOSED', 'This event can no longer be edited.', 409);
    const start = input.startAt ? new Date(input.startAt) : current.startAt;
    const end = input.endAt ? new Date(input.endAt) : current.endAt;
    const deadline =
      input.registrationDeadline === undefined
        ? current.registrationDeadline
        : input.registrationDeadline
          ? new Date(input.registrationDeadline)
          : undefined;
    const mode = input.mode ?? current.mode;
    const venue = input.venue === undefined ? current.venue : input.venue;
    const meetingLink = input.meetingLink === undefined ? current.meetingLink : input.meetingLink;
    if (end <= start || start <= new Date())
      throw new AppError('INVALID_EVENT_TIME', 'Event times must be valid and in the future.', 422);
    if (deadline && deadline >= start)
      throw new AppError(
        'INVALID_REGISTRATION_DEADLINE',
        'Registration must close before the event starts.',
        422,
      );
    if ((mode === 'OFFLINE' || mode === 'HYBRID') && !venue?.trim())
      throw new AppError('VENUE_REQUIRED', 'Venue is required for offline or hybrid events.', 422);
    if ((mode === 'ONLINE' || mode === 'HYBRID') && !meetingLink?.trim())
      throw new AppError(
        'MEETING_LINK_REQUIRED',
        'Meeting link is required for online or hybrid events.',
        422,
      );
    const changes: Partial<EventDocument> = {
      startAt: start,
      endAt: end,
      mode,
      ...(deadline ? { registrationDeadline: deadline } : {}),
    };
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.category !== undefined) changes.category = input.category;
    if (input.tags !== undefined) changes.tags = input.tags;
    if (input.coverImageUrl !== undefined) changes.coverImageUrl = input.coverImageUrl;
    if (input.venue !== undefined) changes.venue = input.venue;
    if (input.meetingLink !== undefined) changes.meetingLink = input.meetingLink;
    if (input.registrationDeadline !== undefined && deadline)
      changes.registrationDeadline = deadline;
    if (input.capacity !== undefined) changes.capacity = input.capacity;
    if (input.registrationRequired !== undefined)
      changes.registrationRequired = input.registrationRequired;
    if (input.visibility !== undefined) changes.visibility = input.visibility;
    if (input.rules !== undefined) changes.rules = input.rules;
    if (input.teamId !== undefined) changes.teamId = this.id(input.teamId);
    if (input.communityId !== undefined) changes.communityId = this.id(input.communityId);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.eventRecords.update(eventId, changes, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
      await this.record(
        'EVENT_UPDATED',
        'EVENT',
        eventId,
        actor.userId,
        correlationId,
        { eventId },
        session,
      );
      return result;
    });
    return this.eventViewFor(actor, updated);
  }
  async cancelEvent(actor: Actor, eventId: string, correlationId: string) {
    this.active(actor);
    const current = await this.eventRecords.findById(eventId);
    if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    if (current.organizerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the event organizer can cancel this event.', 403);
    if (current.status === 'ARCHIVED')
      throw new AppError('EVENT_CLOSED', 'This event is archived.', 409);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.eventRecords.update(eventId, { status: 'CANCELLED' }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
      await this.record(
        'EVENT_CANCELLED',
        'EVENT',
        eventId,
        actor.userId,
        correlationId,
        { eventId },
        session,
      );
      return result;
    });
    return this.eventViewFor(actor, updated);
  }
  async archiveEvent(actor: Actor, eventId: string, correlationId: string) {
    this.active(actor);
    const current = await this.eventRecords.findById(eventId);
    if (!current) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    if (current.organizerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the event organizer can archive this event.', 403);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.eventRecords.update(eventId, { status: 'ARCHIVED' }, session);
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
      await this.record(
        'EVENT_ARCHIVED',
        'EVENT',
        eventId,
        actor.userId,
        correlationId,
        { eventId },
        session,
      );
      return result;
    });
    return this.eventViewFor(actor, updated);
  }
  async registerForEvent(actor: Actor, eventId: string, correlationId: string) {
    this.active(actor);
    const event = await this.eventRecords.findById(eventId);
    if (!event) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    await this.eventAccess(actor, event);
    const existing = await this.eventRecords.findRegistration(eventId, actor.userId);
    if (existing && ['REGISTERED', 'ATTENDED'].includes(existing.status))
      throw new AppError('ALREADY_REGISTERED', 'You are already registered for this event.', 409);
    const status = this.eventStatus(event);
    if (!event.registrationRequired)
      throw new AppError(
        'REGISTRATION_NOT_REQUIRED',
        'This event does not require registration.',
        409,
      );
    if (!['UPCOMING', 'ONGOING'].includes(status))
      throw new AppError('REGISTRATION_CLOSED', 'Registration is closed for this event.', 409);
    if (event.registrationDeadline && event.registrationDeadline <= new Date())
      throw new AppError('REGISTRATION_CLOSED', 'Registration deadline has passed.', 409);
    const result = await withMongoTransaction(async (session) => {
      const reserved = await this.eventRecords.reserveRegistration(
        eventId,
        actor.userId,
        new Date(),
        session,
      );
      if (!reserved)
        throw new AppError(
          'EVENT_FULL',
          'This event is full or no longer accepting registrations.',
          409,
        );
      await this.record(
        'EVENT_REGISTRATION_CONFIRMED',
        'EVENT_REGISTRATION',
        reserved.registration.id,
        actor.userId,
        correlationId,
        { eventId, recipientId: actor.userId },
        session,
      );
      return reserved;
    });
    return this.eventViewFor(actor, result.event, result.registration);
  }
  async cancelEventRegistration(actor: Actor, eventId: string, correlationId: string) {
    this.active(actor);
    const event = await this.eventRecords.findById(eventId);
    if (!event) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    const registration = await this.eventRecords.findRegistration(eventId, actor.userId);
    if (!registration || registration.status !== 'REGISTERED')
      throw new AppError(
        'REGISTRATION_NOT_FOUND',
        'An active event registration was not found.',
        404,
      );
    await withMongoTransaction(async (session) => {
      const cancelled = await this.eventRecords.cancelRegistration(
        eventId,
        actor.userId,
        new Date(),
        session,
      );
      if (!cancelled)
        throw new AppError(
          'REGISTRATION_NOT_FOUND',
          'An active event registration was not found.',
          404,
        );
      await this.eventRecords.decrementRegistrationCount(eventId, session);
      await this.record(
        'EVENT_REGISTRATION_CANCELLED',
        'EVENT_REGISTRATION',
        cancelled.id,
        actor.userId,
        correlationId,
        { eventId, recipientId: actor.userId },
        session,
      );
    });
    return this.eventViewFor(actor, event);
  }
  async listEventRegistrations(actor: Actor, eventId: string, input: CursorInput) {
    const event = await this.eventRecords.findById(eventId);
    if (!event) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    if (event.organizerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the event organizer can view participants.', 403);
    const registrations = await this.eventRecords.listRegistrations(
      eventId,
      this.cursorFilter(input.cursor),
      input.limit + 1,
    );
    const users = await this.users.findByIds(registrations.map((item) => item.userId));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return this.page(
      registrations.map((item) =>
        this.eventRegistrationView(item, usersById.get(item.userId.toString())),
      ),
      input.limit,
    );
  }
  async updateEventRegistration(
    actor: Actor,
    eventId: string,
    registrationId: string,
    status: EventRegistrationStatus,
    correlationId: string,
  ) {
    this.active(actor);
    const event = await this.eventRecords.findById(eventId);
    if (!event) throw new AppError('RESOURCE_NOT_FOUND', 'The event was not found.', 404);
    if (event.organizerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the event organizer can manage registrations.', 403);
    const registration = await this.eventRecords
      .listRegistrations(eventId, { _id: registrationId }, 1)
      .then((items) => items[0]);
    if (!registration)
      throw new AppError('REGISTRATION_NOT_FOUND', 'The event registration was not found.', 404);
    let updated: EventRegistrationDocument | null = null;
    if (status === 'CANCELLED' && registration.status === 'REGISTERED') {
      await withMongoTransaction(async (session) => {
        updated = await this.eventRecords.updateRegistration(
          registrationId,
          { status: 'CANCELLED', cancelledAt: new Date() },
          session,
        );
        await this.eventRecords.decrementRegistrationCount(eventId, session);
      });
    } else if (status === 'REGISTERED' && registration.status === 'CANCELLED') {
      await withMongoTransaction(async (session) => {
        const reserved = await this.eventRecords.reserveRegistration(
          eventId,
          registration.userId.toString(),
          new Date(),
          session,
        );
        if (!reserved)
          throw new AppError(
            'EVENT_FULL',
            'This event is full or no longer accepting registrations.',
            409,
          );
        updated = reserved.registration;
      });
    } else if (['ATTENDED', 'NO_SHOW'].includes(status) && registration.status !== 'REGISTERED') {
      throw new AppError(
        'INVALID_REGISTRATION_STATUS',
        'Only active registrations can be marked for attendance.',
        422,
      );
    } else {
      updated = await this.eventRecords.updateRegistration(registrationId, { status });
      if (!updated)
        throw new AppError('REGISTRATION_NOT_FOUND', 'The event registration was not found.', 404);
    }
    if (!updated)
      throw new AppError('REGISTRATION_NOT_FOUND', 'The event registration was not found.', 404);
    await this.events.record({
      eventType: 'EVENT_UPDATED',
      producer: 'collaboration',
      aggregateType: 'EVENT_REGISTRATION',
      aggregateId: registrationId,
      actorId: actor.userId,
      correlationId,
      payload: { eventId, userId: updated.userId.toString() },
    });
    const user = await this.users.findById(updated.userId.toString());
    return this.eventRegistrationView(updated, user ?? undefined);
  }
  private async requireProject(projectId: string) {
    const project = await this.projects.findById(projectId);
    if (!project) throw new AppError('RESOURCE_NOT_FOUND', 'The project was not found.', 404);
    return project;
  }
}
