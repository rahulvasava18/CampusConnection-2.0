import { Types } from 'mongoose';
import type { ProfileView } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { UserModel } from '../../identity/infrastructure/user.model';
import { BlockModel, ConnectionModel, PostModel } from '../../social/infrastructure/social.models';
import { SocialService } from '../../social/application/social.service';
import {
  CommunityMemberModel,
  CommunityModel,
  EventModel,
  EventRegistrationModel,
  ProjectMemberModel,
  ProjectModel,
  TaskModel,
  TeamMemberModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';

interface ProfileActor {
  userId: string;
  accountState: string;
  roles: string[];
}

interface ProfileInput {
  limit: number;
  cursor?: string;
}

function ids(values: unknown[]): string[] {
  return [...new Set(values.map((value) => String(value)))];
}

function teamRole(value: string | undefined): 'OWNER' | 'CO_LEAD' | 'MEMBER' {
  if (value === 'CO_LEAD') return 'CO_LEAD';
  if (value === 'OWNER') return 'OWNER';
  return 'MEMBER';
}

function communityRole(value: string | undefined): 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER' {
  if (value === 'ADMIN' || value === 'MODERATOR' || value === 'OWNER') return value;
  return 'MEMBER';
}

export class ProfileService {
  public constructor(private readonly social = new SocialService()) {}

  public async get(actor: ProfileActor, userId: string, input: ProfileInput): Promise<ProfileView> {
    if (!Types.ObjectId.isValid(userId))
      throw new AppError('RESOURCE_NOT_FOUND', 'The profile was not found.', 404);
    const user = await UserModel.findById(userId).exec();
    if (!user || ['BANNED', 'DELETED', 'SUSPENDED'].includes(user.accountState))
      throw new AppError('RESOURCE_NOT_FOUND', 'The profile was not found.', 404);
    const ownProfile = actor.userId === userId;
    if (!ownProfile && user.preferences?.privacy.profileDiscoverable === false)
      throw new AppError('PROFILE_PRIVATE', 'This profile is not available for discovery.', 404);
    if (!ownProfile) {
      const blocked = await BlockModel.exists({
        $or: [
          { blockerId: actor.userId, blockedUserId: userId },
          { blockerId: userId, blockedUserId: actor.userId },
        ],
      });
      if (blocked) throw new AppError('RESOURCE_NOT_FOUND', 'The profile was not found.', 404);
    }

    const connected = ownProfile
      ? true
      : Boolean(
          await ConnectionModel.exists({
            $or: [
              { userAId: actor.userId, userBId: userId },
              { userAId: userId, userBId: actor.userId },
            ],
            state: 'ACCEPTED',
          }),
        );
    const projectVisibility = ownProfile
      ? { $in: ['PUBLIC', 'CAMPUS', 'CONNECTIONS', 'PRIVATE'] }
      : connected
        ? { $in: ['PUBLIC', 'CAMPUS', 'CONNECTIONS'] }
        : { $in: ['PUBLIC', 'CAMPUS'] };
    const teamVisibility = ownProfile
      ? { $in: ['PUBLIC', 'CAMPUS', 'PRIVATE'] }
      : { $in: ['PUBLIC', 'CAMPUS'] };
    const communityPrivacy = ownProfile
      ? { $in: ['PUBLIC', 'CAMPUS', 'PRIVATE'] }
      : { $in: ['PUBLIC', 'CAMPUS'] };
    const eventVisibility = ownProfile
      ? { $in: ['PUBLIC', 'CAMPUS', 'PRIVATE'] }
      : { $in: ['PUBLIC', 'CAMPUS'] };

    const [
      communityMemberships,
      teamMemberships,
      projectMemberships,
      registeredEvents,
      projectIds,
      teamIds,
      communityIds,
      registeredEventIds,
      organizedEventIds,
      postCount,
    ] = await Promise.all([
      CommunityMemberModel.find({ userId, status: 'ACTIVE' })
        .sort({ createdAt: -1 })
        .limit(30)
        .exec(),
      TeamMemberModel.find({ userId, status: 'ACTIVE' }).sort({ createdAt: -1 }).limit(30).exec(),
      ProjectMemberModel.find({ userId, status: 'ACTIVE' })
        .sort({ createdAt: -1 })
        .limit(30)
        .exec(),
      EventRegistrationModel.find({ userId, status: { $in: ['REGISTERED', 'ATTENDED'] } })
        .sort({ registeredAt: -1 })
        .limit(30)
        .exec(),
      ProjectModel.distinct('_id', {
        $or: [
          { ownerId: userId },
          {
            _id: {
              $in: await ProjectMemberModel.distinct('projectId', { userId, status: 'ACTIVE' }),
            },
          },
        ],
        status: { $ne: 'ARCHIVED' },
        visibility: projectVisibility,
      }),
      TeamModel.distinct('_id', {
        $or: [
          { ownerId: userId },
          { _id: { $in: await TeamMemberModel.distinct('teamId', { userId, status: 'ACTIVE' }) } },
        ],
        status: { $ne: 'ARCHIVED' },
        visibility: teamVisibility,
      }),
      CommunityModel.distinct('_id', {
        $or: [
          { ownerId: userId },
          {
            _id: {
              $in: await CommunityMemberModel.distinct('communityId', { userId, status: 'ACTIVE' }),
            },
          },
        ],
        status: 'ACTIVE',
        privacy: communityPrivacy,
      }),
      EventRegistrationModel.distinct('eventId', {
        userId,
        status: { $in: ['REGISTERED', 'ATTENDED'] },
      }),
      EventModel.distinct('_id', {
        organizerId: userId,
        status: { $ne: 'ARCHIVED' },
        visibility: eventVisibility,
      }),
      PostModel.countDocuments({
        authorId: userId,
        status: 'ACTIVE',
        ...(ownProfile
          ? {}
          : {
              visibility: {
                $in: connected ? ['PUBLIC', 'CAMPUS', 'CONNECTIONS'] : ['PUBLIC', 'CAMPUS'],
              },
              communityId: null,
            }),
      }).exec(),
    ]);

    const communityIdList = ids(communityIds);
    const teamIdList = ids(teamIds);
    const projectIdList = ids(projectIds);
    const eventIdList = ids([...registeredEventIds, ...organizedEventIds]);
    const [communities, teams, projects, events] = await Promise.all([
      CommunityModel.find({
        _id: { $in: communityIdList },
        status: 'ACTIVE',
        privacy: communityPrivacy,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .exec(),
      TeamModel.find({
        _id: { $in: teamIdList },
        status: { $ne: 'ARCHIVED' },
        visibility: teamVisibility,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .exec(),
      ProjectModel.find({
        _id: { $in: projectIdList },
        status: { $ne: 'ARCHIVED' },
        visibility: projectVisibility,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .exec(),
      EventModel.find({
        _id: { $in: eventIdList },
        status: { $ne: 'ARCHIVED' },
        visibility: eventVisibility,
      })
        .sort({ startAt: -1 })
        .limit(20)
        .exec(),
    ]);
    const projectTaskStats = (await TaskModel.aggregate([
      {
        $match: {
          projectId: { $in: projects.map((item) => item._id) },
          archivedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0] } },
        },
      },
    ]).exec()) as Array<{ _id: Types.ObjectId; total: number; completed: number }>;
    const taskStats = new Map(projectTaskStats.map((item) => [item._id.toString(), item]));
    const communityMembershipsById = new Map(
      communityMemberships.map((item) => [item.communityId.toString(), item]),
    );
    const teamMembershipsById = new Map(
      teamMemberships.map((item) => [item.teamId.toString(), item]),
    );
    const projectMembershipsById = new Map(
      projectMemberships.map((item) => [item.projectId.toString(), item]),
    );
    const registrationsByEvent = new Map(
      registeredEvents.map((item) => [item.eventId.toString(), item]),
    );

    const posts = await this.social.listUserPosts(
      { userId: actor.userId, accountState: actor.accountState },
      userId,
      input,
    );
    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        ...(user.bio ? { bio: user.bio } : {}),
        ...(user.college ? { college: user.college } : {}),
        ...(user.department ? { department: user.department } : {}),
        ...(user.course ? { course: user.course } : {}),
        ...(user.graduationYear ? { graduationYear: user.graduationYear } : {}),
        skills: user.skills,
        interests: user.interests,
        goals: user.goals,
        ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
        joinedAt: user.createdAt.toISOString(),
      },
      stats: {
        posts: postCount,
        projects: await ProjectModel.countDocuments({ _id: { $in: projectIds } }).exec(),
        teams: await TeamModel.countDocuments({ _id: { $in: teamIds } }).exec(),
        communities: await CommunityModel.countDocuments({ _id: { $in: communityIds } }).exec(),
        events: await EventModel.countDocuments({
          _id: { $in: [...new Set([...registeredEventIds, ...organizedEventIds].map(String))] },
        }).exec(),
      },
      projects: projects.map((item) => {
        const membership = projectMembershipsById.get(item.id);
        const taskStatsForProject = taskStats.get(item.id);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          status: item.status,
          role: item.ownerId.toString() === userId ? ('OWNER' as const) : ('COLLABORATOR' as const),
          technologies: item.technologies,
          progressPercent: taskStatsForProject?.total
            ? Math.round((taskStatsForProject.completed / taskStatsForProject.total) * 100)
            : 0,
          ...(item.coverImageUrl ? { coverImageUrl: item.coverImageUrl } : {}),
          ...(membership ? {} : {}),
        };
      }),
      teams: teams.map((item) => {
        const membership = teamMembershipsById.get(item.id);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          status: item.status,
          role:
            item.ownerId.toString() === userId ? ('OWNER' as const) : teamRole(membership?.role),
          ...(typeof item.memberCount === 'number' ? { memberCount: item.memberCount } : {}),
          ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {}),
        };
      }),
      communities: communities.map((item) => {
        const membership = communityMembershipsById.get(item.id);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          privacy: item.privacy,
          role:
            item.ownerId.toString() === userId
              ? ('OWNER' as const)
              : communityRole(membership?.role),
          ...(typeof item.memberCount === 'number' ? { memberCount: item.memberCount } : {}),
          ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {}),
        };
      }),
      events: events.map((item) => {
        const registration = registrationsByEvent.get(item.id);
        return {
          id: item.id,
          title: item.title,
          category: item.category,
          status: item.status,
          mode: item.mode,
          startAt: item.startAt.toISOString(),
          endAt: item.endAt.toISOString(),
          visibility: item.visibility,
          participation:
            item.organizerId.toString() === userId
              ? ('ORGANIZER' as const)
              : registration?.status === 'ATTENDED'
                ? ('ATTENDED' as const)
                : ('REGISTERED' as const),
          ...(item.coverImageUrl ? { coverImageUrl: item.coverImageUrl } : {}),
        };
      }),
      posts,
      isOwnProfile: ownProfile,
    };
  }
}
