import { UserModel, type UserDocument } from '../../identity/infrastructure/user.model';
import {
  CommunityMemberModel,
  CommunityModel,
  ProjectMemberModel,
  ProjectModel,
  TeamMemberModel,
  TeamModel,
  TeamRequirementModel,
  type CommunityDocument,
  type ProjectDocument,
  type TeamDocument,
  type TeamRequirementDocument,
} from '../../collaboration/infrastructure/collaboration.models';
import { BlockRepository } from '../../social/infrastructure/social.repositories';
import { ConnectionModel, PostModel } from '../../social/infrastructure/social.models';
import { AppError } from '../../../shared/errors/app-error';
import { RecommendationSignalModel } from '../infrastructure/recommendation.models';
import { getRecommendationReadiness } from './readiness';

export interface RecommendationProfile {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  college?: string;
  course?: string;
  skills: string[];
  interests: string[];
  goals: string[];
}

export interface RecommendationContext {
  profile: RecommendationProfile;
  blockedIds: string[];
  connectedIds: string[];
  pendingIds: string[];
  communityIds: string[];
  teamIds: string[];
  projectIds: string[];
  dismissedIds: string[];
  readiness: ReturnType<typeof getRecommendationReadiness>;
}

const ACTIVE_ACCOUNT_STATES = ['ACTIVE', 'RESTRICTED'];
const normalize = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)),
];
const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const signalRegex = (values: string[]): string => values.slice(0, 5).map(escapeRegex).join('|');

export async function loadRecommendationContext(
  userId: string,
  blocks = new BlockRepository(),
): Promise<RecommendationContext> {
  const [profile, blockedIds, connections, memberships, pending, dismissed, authoredPostCount] =
    await Promise.all([
      UserModel.findById(userId)
        .select(
          'username displayName bio avatarUrl college course skills interests goals accountState',
        )
        .lean()
        .exec(),
      blocks.blockedUserIds(userId),
      ConnectionModel.find({
        $or: [{ userAId: userId }, { userBId: userId }],
        state: { $in: ['ACCEPTED', 'PENDING'] },
      })
        .select('userAId userBId state')
        .lean()
        .exec(),
      Promise.all([
        CommunityMemberModel.find({ userId, status: 'ACTIVE' }).select('communityId').lean().exec(),
        TeamMemberModel.find({ userId, status: 'ACTIVE' }).select('teamId').lean().exec(),
        ProjectMemberModel.find({ userId, status: 'ACTIVE' }).select('projectId').lean().exec(),
      ]),
      ConnectionModel.find({ requestedBy: userId, state: 'PENDING' })
        .select('userAId userBId')
        .lean()
        .exec(),
      RecommendationSignalModel.find({ userId, signalType: 'RECOMMENDATION_DISMISS' })
        .select('targetId')
        .lean()
        .exec(),
      PostModel.countDocuments({ authorId: userId, status: 'ACTIVE' }).exec(),
    ]);
  if (!profile || !ACTIVE_ACCOUNT_STATES.includes(profile.accountState))
    throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot use recommendations.', 403);
  const connectedIds = connections
    .filter((item) => item.state === 'ACCEPTED')
    .map((item) =>
      item.userAId.toString() === userId ? item.userBId.toString() : item.userAId.toString(),
    );
  const pendingIds = pending.map((item) =>
    item.userAId.toString() === userId ? item.userBId.toString() : item.userAId.toString(),
  );
  return {
    profile: {
      id: String(profile._id),
      username: profile.username,
      displayName: profile.displayName,
      ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      ...(profile.bio ? { bio: profile.bio } : {}),
      ...(profile.college ? { college: profile.college } : {}),
      ...(profile.course ? { course: profile.course } : {}),
      skills: normalize(profile.skills),
      interests: normalize(profile.interests),
      goals: normalize(profile.goals),
    },
    blockedIds: [...new Set(blockedIds)],
    connectedIds: [...new Set(connectedIds)],
    pendingIds: [...new Set(pendingIds)],
    communityIds: memberships[0].map((item) => item.communityId.toString()),
    teamIds: memberships[1].map((item) => item.teamId.toString()),
    projectIds: memberships[2].map((item) => item.projectId.toString()),
    dismissedIds: dismissed
      .map((item) => item.targetId?.toString())
      .filter((item): item is string => Boolean(item)),
    readiness: getRecommendationReadiness(
      {
        ...(profile.bio ? { bio: profile.bio } : {}),
        ...(profile.college ? { college: profile.college } : {}),
        ...(profile.course ? { course: profile.course } : {}),
        skills: normalize(profile.skills),
        interests: normalize(profile.interests),
        goals: normalize(profile.goals),
      },
      {
        acceptedConnectionCount: connections.filter((item) => item.state === 'ACCEPTED').length,
        communityMembershipCount: memberships[0].length,
        teamMembershipCount: memberships[1].length,
        projectMembershipCount: memberships[2].length,
        authoredPostCount,
      },
    ),
  };
}

function signalFilter(values: string[], fields: string[]): Record<string, unknown> {
  return values.length ? { $or: fields.map((field) => ({ [field]: { $in: values } })) } : {};
}

export async function generateUserCandidates(
  context: RecommendationContext,
  limit = 200,
): Promise<UserDocument[]> {
  const excluded = [
    context.profile.id,
    ...context.blockedIds,
    ...context.connectedIds,
    ...context.pendingIds,
    ...context.dismissedIds,
  ];
  const values = [
    ...context.profile.skills,
    ...context.profile.interests,
    ...context.profile.goals,
  ];
  const filter: Record<string, unknown> = {
    accountState: { $in: ACTIVE_ACCOUNT_STATES },
    'preferences.privacy.showInRecommendations': { $ne: false },
    _id: { $nin: excluded },
  };
  const relevance = signalFilter(values, ['skills', 'interests', 'goals']);
  if (Object.keys(relevance).length)
    filter.$or = [
      ...(relevance.$or as Record<string, unknown>[]),
      ...(context.profile.college ? [{ college: context.profile.college }] : []),
    ];
  return UserModel.find(filter)
    .select(
      'username displayName avatarUrl college course skills interests goals createdAt accountState',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec() as unknown as UserDocument[];
}

export async function generateTeamCandidates(
  context: RecommendationContext,
  limit = 200,
): Promise<Array<TeamDocument & { openSlots: number; requirements: TeamRequirementDocument[] }>> {
  const skillValues = [...context.profile.skills, ...context.profile.interests];
  const filter: Record<string, unknown> = {
    status: { $in: ['RECRUITING', 'ACTIVE'] },
    visibility: { $in: ['PUBLIC', 'CAMPUS'] },
    _id: { $nin: [...context.teamIds, ...context.dismissedIds] },
  };
  if (skillValues.length)
    filter.$or = [
      {
        _id: {
          $in: await TeamRequirementModel.find({
            $or: [{ skills: { $in: skillValues } }, { interests: { $in: skillValues } }],
            $expr: { $lt: ['$filledSlots', '$slots'] },
          })
            .distinct('teamId')
            .exec(),
        },
      },
      { category: { $in: skillValues } },
      { tags: { $in: skillValues } },
      { lookingFor: { $in: skillValues } },
      { status: 'RECRUITING' },
    ];
  const teams = await TeamModel.find(filter)
    .select(
      'name description ownerId projectId communityId status category tags lookingFor maxMembers visibility createdAt',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();
  const teamIds = teams.map((team) => team._id);
  const [requirements, members] = await Promise.all([
    TeamRequirementModel.find({
      teamId: { $in: teamIds },
      $expr: { $lt: ['$filledSlots', '$slots'] },
    })
      .sort({ priority: -1 })
      .lean()
      .exec(),
    TeamMemberModel.aggregate([
      { $match: { teamId: { $in: teamIds }, status: 'ACTIVE' } },
      { $group: { _id: '$teamId', count: { $sum: 1 } } },
    ]).exec(),
  ]);
  const counts = new Map(
    members.map((item: { _id: unknown; count: number }) => [String(item._id), item.count]),
  );
  const requirementMap = new Map<string, TeamRequirementDocument[]>();
  for (const requirement of requirements)
    requirementMap.set(requirement.teamId.toString(), [
      ...(requirementMap.get(requirement.teamId.toString()) ?? []),
      requirement as unknown as TeamRequirementDocument,
    ]);
  return teams.map((team) => {
    const teamId = String(team._id);
    return {
      ...team,
      openSlots: team.maxMembers ? Math.max(team.maxMembers - (counts.get(teamId) ?? 0), 0) : 1,
      requirements: requirementMap.get(teamId) ?? [],
    };
  }) as unknown as Array<
    TeamDocument & { openSlots: number; requirements: TeamRequirementDocument[] }
  >;
}

export async function generateProjectCandidates(
  context: RecommendationContext,
  limit = 200,
): Promise<ProjectDocument[]> {
  const visibility: Record<string, unknown>[] = [{ visibility: { $in: ['PUBLIC', 'CAMPUS'] } }];
  const values = [
    ...context.profile.skills,
    ...context.profile.interests,
    ...context.profile.goals,
  ];
  const filter: Record<string, unknown> = {
    status: { $in: ['PLANNING', 'ACTIVE'] },
    _id: { $nin: [...context.projectIds, ...context.dismissedIds] },
    $or: visibility,
  };
  if (values.length)
    filter.$and = [
      { $or: visibility },
      {
        $or: [
          { technologies: { $in: values } },
          { category: { $in: values } },
          { tags: { $in: values } },
          { lookingFor: { $in: values } },
          { name: { $regex: signalRegex(values), $options: 'i' } },
          { description: { $regex: signalRegex(values), $options: 'i' } },
        ],
      },
    ];
  return ProjectModel.find(filter)
    .select(
      'name description objective category tags lookingFor ownerTeamId ownerId status visibility technologies coverImageUrl showcaseEnabled createdAt',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec() as unknown as ProjectDocument[];
}

export async function generateCommunityCandidates(
  context: RecommendationContext,
  limit = 200,
): Promise<CommunityDocument[]> {
  const filter: Record<string, unknown> = {
    status: 'ACTIVE',
    _id: { $nin: [...context.communityIds, ...context.dismissedIds] },
    $or: [
      { privacy: 'PUBLIC' },
      ...(context.profile.college
        ? [{ privacy: 'CAMPUS', collegeId: context.profile.college }]
        : []),
    ],
  };
  const values = [
    ...context.profile.interests,
    ...context.profile.skills,
    ...context.profile.goals,
  ];
  if (values.length)
    filter.$and = [
      { $or: filter.$or as Record<string, unknown>[] },
      {
        $or: [
          { category: { $in: values } },
          { tags: { $in: values } },
          { name: { $regex: signalRegex(values), $options: 'i' } },
          { description: { $regex: signalRegex(values), $options: 'i' } },
        ],
      },
    ];
  return CommunityModel.find(filter)
    .select('name description avatarUrl category tags collegeId privacy status ownerId createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec() as unknown as CommunityDocument[];
}
