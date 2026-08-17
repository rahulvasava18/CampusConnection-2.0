import type {
  AlgorithmVersion,
  RecommendationCollection,
  RecommendationItem,
  RecommendationReason,
  RecommendationType,
} from '@campusconnection/shared';
import { Types } from 'mongoose';
import { AppError } from '../../../shared/errors/app-error';
import { getRedisClient } from '../../../infrastructure/redis/client';
import { OutboxEventPublisher } from '../../../infrastructure/events/event-publisher';
import { withMongoTransaction } from '../../social/application/social.transaction';
import { BlockRepository } from '../../social/infrastructure/social.repositories';
import { ConnectionModel } from '../../social/infrastructure/social.models';
import { UserModel } from '../../identity/infrastructure/user.model';
import {
  CommunityModel,
  ProjectModel,
  TeamModel,
} from '../../collaboration/infrastructure/collaboration.models';
import {
  RecommendationSignalModel,
  RecommendationSnapshotModel,
} from '../infrastructure/recommendation.models';
import {
  generateCommunityCandidates,
  generateProjectCandidates,
  generateTeamCandidates,
  generateUserCandidates,
  loadRecommendationContext,
  type RecommendationContext,
} from './candidate-generators';
import {
  scoreCommunity,
  scoreProject,
  scoreTeam,
  scoreUser,
  type ScoredCandidate,
} from './scoring';

export interface IntelligenceActor {
  userId: string;
  accountState: string;
}
export type FeedbackKind = 'DISMISS' | 'NOT_RELEVANT' | 'HELPFUL';
const ALGORITHM_VERSION: AlgorithmVersion = 'recommendation-v1';
const FEATURE_VERSION = 'features-v1';
const CACHE_TTL_SECONDS = 60;
const MAX_RESULTS = 50;

function cacheKey(userId: string, type: RecommendationType): string {
  return `recommendations:user:${userId}:type:${type}:version:${ALGORITHM_VERSION}`;
}
function encodeRecommendationCursor(score: number, id: string): string {
  return Buffer.from(JSON.stringify({ score, id, version: ALGORITHM_VERSION }), 'utf8').toString(
    'base64url',
  );
}
function decodeRecommendationCursor(value: string): { score: number; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      score?: number;
      id?: string;
      version?: string;
    };
    if (
      parsed.version !== ALGORITHM_VERSION ||
      typeof parsed.score !== 'number' ||
      typeof parsed.id !== 'string'
    )
      throw new Error();
    return { score: parsed.score, id: parsed.id };
  } catch {
    throw new Error('INVALID_RECOMMENDATION_CURSOR');
  }
}
function sortItems(items: RecommendationItem[]): RecommendationItem[] {
  return items.sort((a, b) => b.score - a.score || b.targetId.localeCompare(a.targetId));
}
function afterCursor(item: RecommendationItem, cursor: { score: number; id: string }): boolean {
  return item.score < cursor.score || (item.score === cursor.score && item.targetId < cursor.id);
}
function safeMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => ['string', 'number', 'boolean'].includes(typeof item) || Array.isArray(item),
    ),
  );
}

export class IntelligenceService {
  private readonly blocks: BlockRepository;
  private readonly events: OutboxEventPublisher;
  public constructor(
    dependencies: { blocks?: BlockRepository; events?: OutboxEventPublisher } = {},
  ) {
    this.blocks = dependencies.blocks ?? new BlockRepository();
    this.events = dependencies.events ?? new OutboxEventPublisher();
  }

  public async getRecommendations(
    actor: IntelligenceActor,
    type: RecommendationType,
    input: { limit: number; cursor?: string },
    options: { skipCache?: boolean } = {},
  ): Promise<RecommendationCollection<RecommendationItem>> {
    this.assertActor(actor);
    const context = await loadRecommendationContext(actor.userId, this.blocks);
    let cursor: { score: number; id: string } | undefined;
    if (input.cursor) {
      try {
        cursor = decodeRecommendationCursor(input.cursor);
      } catch {
        throw new AppError('INVALID_CURSOR', 'The recommendation cursor is invalid.', 400);
      }
    }
    if (!context.readiness.ready)
      return {
        data: [],
        pagination: { hasMore: false, nextCursor: null },
        readiness: context.readiness,
      };
    let items = options.skipCache ? undefined : await this.readCache(actor.userId, type, context);
    if (!items) {
      items = await this.compute(type, context);
      await this.writeCache(actor.userId, type, items);
      await this.persistSnapshots(actor.userId, type, items);
    }
    const visible = cursor ? items.filter((item) => afterCursor(item, cursor!)) : items;
    const page = visible.slice(0, input.limit + 1);
    const data = page.slice(0, input.limit);
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        hasMore: page.length > input.limit,
        nextCursor:
          page.length > input.limit && last
            ? encodeRecommendationCursor(last.score, last.targetId)
            : null,
      },
      readiness: context.readiness,
    };
  }

  public async refreshUserRecommendations(userId: string): Promise<void> {
    const context = await loadRecommendationContext(userId, this.blocks);
    if (!context.readiness.ready) return;
    for (const type of ['PEOPLE', 'TEAMS', 'PROJECTS', 'COMMUNITIES'] as RecommendationType[]) {
      const items = await this.compute(type, context);
      await this.writeCache(userId, type, items);
      await this.persistSnapshots(userId, type, items);
    }
  }

  public async refreshRecommendations(actor: IntelligenceActor): Promise<void> {
    this.assertActor(actor);
    await this.invalidateUser(actor.userId);
    await this.refreshUserRecommendations(actor.userId);
  }

  public async invalidateUser(userId: string): Promise<void> {
    const redis = getRedisClient();
    try {
      await Promise.all(
        (['PEOPLE', 'TEAMS', 'PROJECTS', 'COMMUNITIES'] as RecommendationType[]).map((type) =>
          redis.del(cacheKey(userId, type)),
        ),
      );
    } catch {
      /* Redis is an optimization; Mongo remains authoritative. */
    }
    await RecommendationSnapshotModel.deleteMany({ userId }).exec();
  }

  public async recordFeedback(
    actor: IntelligenceActor,
    recommendationId: string,
    kind: FeedbackKind,
    type: RecommendationType,
    correlationId: string,
  ): Promise<void> {
    this.assertActor(actor);
    if (!Types.ObjectId.isValid(recommendationId))
      throw new AppError('VALIDATION_ERROR', 'The recommendation identifier is invalid.', 422);
    const snapshot = await RecommendationSnapshotModel.findOne({
      userId: actor.userId,
      recommendationType: type,
      candidateId: recommendationId,
      expiresAt: { $gt: new Date() },
    })
      .select('_id')
      .lean()
      .exec();
    if (!snapshot)
      throw new AppError('RESOURCE_NOT_FOUND', 'This recommendation is no longer available.', 404);
    await withMongoTransaction(async (session) => {
      const event = await this.events.record(
        {
          eventType: 'RECOMMENDATION_FEEDBACK',
          producer: 'intelligence',
          aggregateType: type,
          aggregateId: recommendationId,
          actorId: actor.userId,
          correlationId,
          payload: { recommendationId, recommendationType: type, feedback: kind },
        },
        session,
      );
      await RecommendationSignalModel.create(
        [
          {
            sourceEventId: event.eventId,
            userId: new Types.ObjectId(actor.userId),
            signalType: `RECOMMENDATION_${kind}`,
            targetId: new Types.ObjectId(recommendationId),
            value: kind === 'HELPFUL' ? 1 : -1,
            occurredAt: new Date(),
          },
        ],
        { session },
      );
    });
    await this.invalidateUser(actor.userId);
  }

  private async compute(
    type: RecommendationType,
    context: RecommendationContext,
  ): Promise<RecommendationItem[]> {
    if (type === 'PEOPLE') {
      const candidates = await generateUserCandidates(context);
      const candidateIds = candidates.map((candidate) => candidate._id);
      const mutual = await ConnectionModel.aggregate([
        {
          $match: {
            state: 'ACCEPTED',
            $or: [
              { userAId: { $in: context.connectedIds }, userBId: { $in: candidateIds } },
              { userBId: { $in: context.connectedIds }, userAId: { $in: candidateIds } },
            ],
          },
        },
        {
          $project: {
            candidateId: { $cond: [{ $in: ['$userAId', candidateIds] }, '$userAId', '$userBId'] },
          },
        },
        { $group: { _id: '$candidateId', count: { $sum: 1 } } },
      ]).exec();
      const mutualCounts = new Map(
        mutual.map((item: { _id: unknown; count: number }) => [String(item._id), item.count]),
      );
      return sortItems(
        candidates.map((candidate) => {
          const scored = scoreUser(
            context,
            candidate,
            mutualCounts.get(String(candidate._id)) ?? 0,
          );
          return this.userItem(scored);
        }),
      );
    }
    if (type === 'TEAMS')
      return sortItems(
        (await generateTeamCandidates(context)).map((candidate) =>
          this.teamItem(scoreTeam(context, candidate)),
        ),
      );
    if (type === 'PROJECTS')
      return sortItems(
        (await generateProjectCandidates(context)).map((candidate) =>
          this.projectItem(scoreProject(context, candidate)),
        ),
      );
    return sortItems(
      (await generateCommunityCandidates(context)).map((candidate) =>
        this.communityItem(scoreCommunity(context, candidate)),
      ),
    );
  }

  private userItem<
    T extends {
      id?: string;
      _id?: unknown;
      username: string;
      displayName: string;
      bio?: string;
      avatarUrl?: string;
      college?: string;
      course?: string;
      skills: string[];
      interests: string[];
      goals: string[];
      createdAt: Date;
    },
  >(scored: ScoredCandidate<T>): RecommendationItem {
    const candidateId = scored.candidate.id ?? String(scored.candidate._id);
    return this.item(
      'PEOPLE',
      candidateId,
      {
        id: candidateId,
        type: 'PERSON',
        title: scored.candidate.displayName,
        ...(scored.candidate.bio ? { description: scored.candidate.bio } : {}),
        ...(scored.candidate.avatarUrl ? { imageUrl: scored.candidate.avatarUrl } : {}),
        metadata: safeMetadata({
          username: scored.candidate.username,
          college: scored.candidate.college,
          course: scored.candidate.course,
          skills: scored.candidate.skills,
          interests: scored.candidate.interests,
        }),
      },
      scored.score,
      scored.reasons,
    );
  }
  private teamItem<
    T extends {
      id?: string;
      _id?: unknown;
      name: string;
      description: string;
      projectId?: unknown;
      communityId?: unknown;
      category?: string;
      tags?: string[];
      lookingFor?: string[];
      status: string;
      openSlots: number;
      requirements: unknown[];
      createdAt: Date;
    },
  >(scored: ScoredCandidate<T>): RecommendationItem {
    const candidateId = scored.candidate.id ?? String(scored.candidate._id);
    return this.item(
      'TEAMS',
      candidateId,
      {
        id: candidateId,
        type: 'TEAM',
        title: scored.candidate.name,
        description: scored.candidate.description,
        metadata: safeMetadata({
          status: scored.candidate.status,
          openSlots: scored.candidate.openSlots,
          projectId: scored.candidate.projectId?.toString(),
          communityId: scored.candidate.communityId?.toString(),
          category: scored.candidate.category,
          tags: scored.candidate.tags,
          lookingFor: scored.candidate.lookingFor,
        }),
      },
      scored.score,
      scored.reasons,
    );
  }
  private projectItem<
    T extends {
      id?: string;
      _id?: unknown;
      name: string;
      description: string;
      technologies: string[];
      category?: string;
      tags?: string[];
      lookingFor?: string[];
      ownerTeamId?: unknown;
      visibility: string;
      status: string;
      showcaseEnabled: boolean;
      coverImageUrl?: string;
      createdAt: Date;
    },
  >(scored: ScoredCandidate<T>): RecommendationItem {
    const candidateId = scored.candidate.id ?? String(scored.candidate._id);
    return this.item(
      'PROJECTS',
      candidateId,
      {
        id: candidateId,
        type: 'PROJECT',
        title: scored.candidate.name,
        description: scored.candidate.description,
        ...(scored.candidate.coverImageUrl ? { imageUrl: scored.candidate.coverImageUrl } : {}),
        metadata: safeMetadata({
          technologies: scored.candidate.technologies,
          category: scored.candidate.category,
          tags: scored.candidate.tags,
          lookingFor: scored.candidate.lookingFor,
          status: scored.candidate.status,
          visibility: scored.candidate.visibility,
          showcaseEnabled: scored.candidate.showcaseEnabled,
        }),
      },
      scored.score,
      scored.reasons,
    );
  }
  private communityItem<
    T extends {
      id?: string;
      _id?: unknown;
      name: string;
      description: string;
      avatarUrl?: string;
      category: string;
      tags?: string[];
      privacy: string;
      collegeId?: string;
      createdAt: Date;
    },
  >(scored: ScoredCandidate<T>): RecommendationItem {
    const candidateId = scored.candidate.id ?? String(scored.candidate._id);
    return this.item(
      'COMMUNITIES',
      candidateId,
      {
        id: candidateId,
        type: 'COMMUNITY',
        title: scored.candidate.name,
        description: scored.candidate.description,
        ...(scored.candidate.avatarUrl ? { imageUrl: scored.candidate.avatarUrl } : {}),
        metadata: safeMetadata({
          category: scored.candidate.category,
          tags: scored.candidate.tags,
          privacy: scored.candidate.privacy,
          collegeId: scored.candidate.collegeId,
        }),
      },
      scored.score,
      scored.reasons,
    );
  }
  private item(
    type: RecommendationType,
    targetId: string,
    target: RecommendationItem['target'],
    score: number,
    reasons: RecommendationReason[],
  ): RecommendationItem {
    return {
      id: `${type.toLowerCase()}-${targetId}`,
      targetId,
      type,
      score,
      reasons,
      target,
      generatedAt: new Date().toISOString(),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  private async readCache(
    userId: string,
    type: RecommendationType,
    context: RecommendationContext,
  ): Promise<RecommendationItem[] | undefined> {
    try {
      const raw = await getRedisClient().get(cacheKey(userId, type));
      if (!raw) return undefined;
      const items = JSON.parse(raw) as RecommendationItem[];
      return this.filterCached(type, items, context);
    } catch {
      return undefined;
    }
  }
  private async filterCached(
    type: RecommendationType,
    items: RecommendationItem[],
    context: RecommendationContext,
  ): Promise<RecommendationItem[]> {
    const ids = items.map((item) => item.targetId);
    if (!ids.length) return [];
    if (type === 'PEOPLE') {
      const valid = await UserModel.find({
        _id: { $in: ids },
        accountState: { $in: ['ACTIVE', 'RESTRICTED'] },
      })
        .select('_id')
        .lean()
        .exec();
      const allowed = new Set(valid.map((item) => String(item._id)));
      return items.filter(
        (item) =>
          allowed.has(item.targetId) &&
          !context.blockedIds.includes(item.targetId) &&
          !context.connectedIds.includes(item.targetId) &&
          !context.pendingIds.includes(item.targetId) &&
          !context.dismissedIds.includes(item.targetId),
      );
    }
    if (type === 'TEAMS') {
      const valid = await TeamModel.find({
        _id: { $in: ids },
        status: { $in: ['RECRUITING', 'ACTIVE'] },
        visibility: { $in: ['PUBLIC', 'CAMPUS'] },
      })
        .select('_id')
        .lean()
        .exec();
      return items.filter(
        (item) =>
          valid.some((candidate) => String(candidate._id) === item.targetId) &&
          !context.teamIds.includes(item.targetId) &&
          !context.dismissedIds.includes(item.targetId),
      );
    }
    if (type === 'PROJECTS') {
      const valid = await ProjectModel.find({
        _id: { $in: ids },
        status: { $in: ['PLANNING', 'ACTIVE'] },
        visibility: { $in: ['PUBLIC', 'CAMPUS'] },
      })
        .select('_id')
        .lean()
        .exec();
      return items.filter(
        (item) =>
          valid.some((candidate) => String(candidate._id) === item.targetId) &&
          !context.projectIds.includes(item.targetId) &&
          !context.dismissedIds.includes(item.targetId),
      );
    }
    const valid = await CommunityModel.find({
      _id: { $in: ids },
      status: 'ACTIVE',
      $or: [
        { privacy: 'PUBLIC' },
        ...(context.profile.college
          ? [{ privacy: 'CAMPUS', collegeId: context.profile.college }]
          : []),
      ],
    })
      .select('_id')
      .lean()
      .exec();
    return items.filter(
      (item) =>
        valid.some((candidate) => String(candidate._id) === item.targetId) &&
        !context.communityIds.includes(item.targetId) &&
        !context.dismissedIds.includes(item.targetId),
    );
  }
  private async writeCache(
    userId: string,
    type: RecommendationType,
    items: RecommendationItem[],
  ): Promise<void> {
    try {
      await getRedisClient().set(
        cacheKey(userId, type),
        JSON.stringify(items.slice(0, MAX_RESULTS)),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch {
      /* Cache failure falls back to MongoDB. */
    }
  }
  private async persistSnapshots(
    userId: string,
    type: RecommendationType,
    items: RecommendationItem[],
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.valueOf() + 5 * 60 * 1000);
    await RecommendationSnapshotModel.deleteMany({ userId, recommendationType: type }).exec();
    if (items.length)
      await RecommendationSnapshotModel.insertMany(
        items.slice(0, MAX_RESULTS).map((item, index) => ({
          userId,
          recommendationType: type,
          candidateId: item.targetId,
          score: item.score,
          reasonCodes: item.reasons.map((reasonItem) => reasonItem.code),
          rank: index,
          featureVersion: FEATURE_VERSION,
          algorithmVersion: ALGORITHM_VERSION,
          generatedAt: now,
          expiresAt,
        })),
        { ordered: false },
      );
  }
  private assertActor(actor: IntelligenceActor): void {
    if (!['ACTIVE', 'RESTRICTED'].includes(actor.accountState))
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot use recommendations.', 403);
  }
}
