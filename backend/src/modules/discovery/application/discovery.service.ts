import { Types } from 'mongoose';
import type {
  ApiCollection,
  SearchEntityType,
  SearchFilters,
  SearchResult,
  TeamMatchResult,
} from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { BlockRepository } from '../../social/infrastructure/social.repositories';
import { UserModel } from '../../identity/infrastructure/user.model';
import {
  CommunityMemberModel,
  ProjectMemberModel,
  TeamMemberModel,
  TeamModel,
  TeamRequirementModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { ConnectionModel } from '../../social/infrastructure/social.models';
import type { SearchProvider } from '../infrastructure/search.provider';
import { createSearchProvider, type SearchContext } from '../infrastructure/search.provider';

export interface DiscoveryActor {
  userId: string;
  accountState: string;
  college?: string;
}
export interface DiscoverySearchInput {
  query: string;
  entityTypes: SearchEntityType[];
  filters: SearchFilters;
  limit: number;
  cursor?: string;
}

export class DiscoveryService {
  private readonly provider: SearchProvider;
  private readonly blocks: BlockRepository;

  public constructor(dependencies: { provider?: SearchProvider; blocks?: BlockRepository } = {}) {
    this.provider = dependencies.provider ?? createSearchProvider();
    this.blocks = dependencies.blocks ?? new BlockRepository();
  }

  public async search(
    actor: DiscoveryActor,
    input: DiscoverySearchInput,
  ): Promise<ApiCollection<SearchResult>> {
    const context = await this.context(actor);
    return this.provider.search({ ...input, context });
  }

  public async autocomplete(
    actor: DiscoveryActor,
    query: string,
    entityTypes: SearchEntityType[],
    filters: SearchFilters,
  ): Promise<SearchResult[]> {
    const context = await this.context(actor);
    return this.provider.autocomplete({ query, entityTypes, filters, context });
  }

  public async matchTeam(actor: DiscoveryActor, teamId: string): Promise<TeamMatchResult> {
    if (!Types.ObjectId.isValid(teamId))
      throw new AppError('VALIDATION_ERROR', 'The team identifier is invalid.', 422);
    const team = await TeamModel.findById(teamId).lean().exec();
    if (!team || team.status === 'ARCHIVED')
      throw new AppError('RESOURCE_NOT_FOUND', 'The team was not found.', 404);
    const membership = await TeamMemberModel.exists({
      teamId,
      userId: actor.userId,
      status: 'ACTIVE',
    });
    if (team.visibility === 'PRIVATE' && team.ownerId.toString() !== actor.userId && !membership)
      throw new AppError('FORBIDDEN', 'You cannot inspect this team match.', 403);
    const [user, requirements] = await Promise.all([
      UserModel.findById(actor.userId).select('skills interests goals').lean().exec(),
      TeamRequirementModel.find({ teamId, $expr: { $lt: ['$filledSlots', '$slots'] } })
        .sort({ priority: -1 })
        .lean()
        .exec(),
    ]);
    if (!user) throw new AppError('RESOURCE_NOT_FOUND', 'The user was not found.', 404);
    const userSkills = new Set(user.skills.map((skill) => skill.toLowerCase()));
    const userInterests = new Set(user.interests.map((interest) => interest.toLowerCase()));
    let totalWeight = 0;
    let matchedWeight = 0;
    const required: string[] = [];
    const preferred: string[] = [];
    for (const requirement of requirements) {
      const weight = Math.max(requirement.priority, 1);
      const matchedSkills = requirement.skills.filter((skill) =>
        userSkills.has(skill.toLowerCase()),
      );
      const matchedInterests = requirement.interests.filter((interest) =>
        userInterests.has(interest.toLowerCase()),
      );
      const skillWeight = requirement.skills.length
        ? matchedSkills.length / requirement.skills.length
        : 0;
      const interestWeight = requirement.interests.length
        ? matchedInterests.length / requirement.interests.length
        : 0;
      const coverage =
        requirement.skills.length || requirement.interests.length
          ? Math.max(skillWeight, interestWeight)
          : 0;
      totalWeight += weight;
      matchedWeight += weight * coverage;
      const bucket = requirement.priority >= 70 ? required : preferred;
      bucket.push(...matchedSkills, ...matchedInterests);
    }
    const uniqueRequired = [...new Set(required)];
    const uniquePreferred = [...new Set(preferred)];
    const reasons = [];
    if (uniqueRequired.length)
      reasons.push({
        code: 'REQUIRED_SKILLS',
        message: `Matches ${uniqueRequired.length} required skill or interest signals.`,
        matched: uniqueRequired,
      });
    if (uniquePreferred.length)
      reasons.push({
        code: 'PREFERRED_SKILLS',
        message: `Matches ${uniquePreferred.length} preferred skill or interest signals.`,
        matched: uniquePreferred,
      });
    if (!requirements.length)
      reasons.push({
        code: 'NO_OPEN_REQUIREMENTS',
        message: 'The team has no open requirements.',
        matched: [],
      });
    return {
      teamId,
      matchScore: totalWeight ? Number((matchedWeight / totalWeight).toFixed(2)) : 0,
      reasons,
      coveredRequiredSkills: uniqueRequired,
      coveredPreferredSkills: uniquePreferred,
    };
  }

  private async context(actor: DiscoveryActor): Promise<SearchContext> {
    if (!actor.userId || ['BANNED', 'SUSPENDED', 'DELETED'].includes(actor.accountState))
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot use discovery.', 403);
    const [blockedUserIds, communityMemberships, teamMemberships, projectMemberships, connections] =
      await Promise.all([
        this.blocks.blockedUserIds(actor.userId),
        CommunityMemberModel.find({ userId: actor.userId, status: 'ACTIVE' })
          .select('communityId')
          .lean()
          .exec(),
        TeamMemberModel.find({ userId: actor.userId, status: 'ACTIVE' })
          .select('teamId')
          .lean()
          .exec(),
        ProjectMemberModel.find({ userId: actor.userId, status: 'ACTIVE' })
          .select('projectId')
          .lean()
          .exec(),
        ConnectionModel.find({
          $or: [{ userAId: actor.userId }, { userBId: actor.userId }],
          state: 'ACCEPTED',
        })
          .select('userAId userBId')
          .lean()
          .exec(),
      ]);
    const connectedUserIds = connections.map((item) =>
      item.userAId.toString() === actor.userId ? item.userBId.toString() : item.userAId.toString(),
    );
    return {
      actorId: actor.userId,
      ...(actor.college ? { actorCollege: actor.college } : {}),
      blockedUserIds,
      communityMemberIds: communityMemberships.map((item) => item.communityId.toString()),
      teamMemberIds: teamMemberships.map((item) => item.teamId.toString()),
      projectMemberIds: projectMemberships.map((item) => item.projectId.toString()),
      connectedUserIds,
    };
  }
}
