import type { FilterQuery } from 'mongoose';
import {
  CommunityModel,
  TeamModel,
  ProjectModel,
  type CommunityDocument,
  type ProjectDocument,
  type TeamDocument,
} from '../../collaboration/infrastructure/collaboration.models';
import { UserModel, type UserDocument } from '../../identity/infrastructure/user.model';
import {
  decodeSearchCursor,
  encodeSearchCursor,
  type ApiCollection,
  type SearchCursorPosition,
  type SearchEntityType,
  type SearchFilters,
  type SearchHighlight,
  type SearchResult,
} from '@campusconnection/shared';
import { getEnv } from '../../../config/env';

export interface SearchContext {
  actorId: string;
  actorCollege?: string;
  blockedUserIds: string[];
  communityMemberIds: string[];
  teamMemberIds: string[];
  projectMemberIds: string[];
  connectedUserIds: string[];
}

export interface SearchInput {
  query: string;
  entityTypes: SearchEntityType[];
  filters: SearchFilters;
  limit: number;
  cursor?: string;
  context: SearchContext;
  prefix?: boolean;
}

interface Candidate {
  result: SearchResult;
  createdAt: Date;
}
interface AtlasDocument {
  _id: unknown;
  id?: string;
  createdAt: Date;
  __searchScore: number;
  [key: string]: unknown;
}

type SearchDocumentWithId = { _id?: unknown; id?: unknown };

/**
 * Lean Mongoose documents expose `_id`, but not the hydrated document `id`
 * virtual. Keep identifier conversion at the persistence boundary so
 * consumers such as direct-message creation always receive a real ObjectId.
 */
export function searchDocumentId(item: SearchDocumentWithId): string {
  const value = item._id ?? item.id;
  if (value === undefined || value === null) throw new Error('SEARCH_DOCUMENT_ID_MISSING');
  return String(value);
}
interface AtlasModel {
  aggregate: (pipeline: object[]) => { exec(): Promise<unknown[]> };
  find: (filter: unknown) => {
    select(fields: string): {
      sort(sort: object): {
        limit(limit: number): { lean(): { exec(): Promise<AtlasDocument[]> } };
      };
    };
  };
}

export interface SearchProvider {
  search(input: SearchInput): Promise<ApiCollection<SearchResult>>;
  autocomplete(input: Omit<SearchInput, 'limit' | 'cursor'>): Promise<SearchResult[]>;
}

const PERSON_FIELDS = [
  'username',
  'displayName',
  'bio',
  'skills',
  'interests',
  'goals',
  'college',
  'department',
  'course',
];
const COMMUNITY_FIELDS = ['name', 'description', 'category', 'collegeId'];
const TEAM_FIELDS = ['name', 'description'];
const PROJECT_FIELDS = ['name', 'description', 'technologies'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function terms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}
function textFilter(fields: string[], query: string, prefix = false): Record<string, unknown> {
  const queryTerms = terms(query);
  if (!queryTerms.length) return {};
  return {
    $or: fields.flatMap((field) =>
      queryTerms.map((term) => ({
        [field]: { $regex: `${prefix ? '^' : ''}${escapeRegExp(term)}`, $options: 'i' },
      })),
    ),
  };
}
function exactFilter(field: string, value: string): Record<string, unknown> {
  return { [field]: { $regex: `^${escapeRegExp(value)}$`, $options: 'i' } };
}
function scoreFor(fields: Array<{ value: unknown; weight: number }>, query: string): number {
  const queryTerms = terms(query);
  if (!queryTerms.length) return 0.1;
  let score = 0;
  for (const field of fields) {
    const values = Array.isArray(field.value)
      ? field.value.map(String)
      : [String(field.value ?? '')];
    for (const value of values) {
      const normalized = value.toLowerCase();
      for (const term of queryTerms) {
        if (normalized === term) score += field.weight * 2;
        else if (normalized.startsWith(term)) score += field.weight * 1.5;
        else if (normalized.includes(term)) score += field.weight;
      }
    }
  }
  return Number(score.toFixed(4));
}
function highlight(field: string, value: string | undefined, query: string): SearchHighlight[] {
  if (!value || !terms(query).some((term) => value.toLowerCase().includes(term))) return [];
  return [{ field, value }];
}
function cursorAfter(candidate: Candidate, cursor: SearchCursorPosition): boolean {
  const date = candidate.createdAt.valueOf();
  const cursorDate = new Date(cursor.createdAt).valueOf();
  return (
    candidate.result.score! < cursor.score ||
    (candidate.result.score === cursor.score &&
      (date < cursorDate || (date === cursorDate && candidate.result.id < cursor.id)))
  );
}

export class MongoSearchProvider implements SearchProvider {
  protected readonly env = getEnv();
  protected readonly useAtlas: boolean = false;

  public async search(input: SearchInput): Promise<ApiCollection<SearchResult>> {
    const candidates = (
      await Promise.all(input.entityTypes.map((type) => this.searchType(type, input)))
    ).flat();
    let cursor: SearchCursorPosition | undefined;
    if (input.cursor) {
      try {
        cursor = decodeSearchCursor(input.cursor);
      } catch {
        throw new Error('INVALID_SEARCH_CURSOR');
      }
    }
    const ordered = candidates.sort(
      (a, b) =>
        b.result.score! - a.result.score! ||
        b.createdAt.valueOf() - a.createdAt.valueOf() ||
        b.result.id.localeCompare(a.result.id),
    );
    const afterCursor = cursor
      ? ordered.filter((candidate) => cursor && cursorAfter(candidate, cursor))
      : ordered;
    const page = afterCursor.slice(0, input.limit + 1);
    const data = page.slice(0, input.limit).map((candidate) => candidate.result);
    const last = data[data.length - 1];
    const lastCandidate = page[input.limit - 1];
    return {
      data,
      pagination: {
        hasMore: page.length > input.limit,
        nextCursor:
          page.length > input.limit && last && lastCandidate
            ? encodeSearchCursor({
                score: last.score ?? 0,
                createdAt: lastCandidate.createdAt.toISOString(),
                id: last.id,
              })
            : null,
      },
    };
  }

  public async autocomplete(input: Omit<SearchInput, 'limit' | 'cursor'>): Promise<SearchResult[]> {
    const page = await this.search({ ...input, limit: 10, prefix: true });
    return page.data.map((item) => ({
      id: searchDocumentId(item),
      type: item.type,
      title: item.title,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      metadata: {},
    }));
  }

  protected async searchType(type: SearchEntityType, input: SearchInput): Promise<Candidate[]> {
    const max = this.env.SEARCH_FALLBACK_MAX_CANDIDATES;
    if (type === 'people') return this.searchPeople(input, max);
    if (type === 'communities') return this.searchCommunities(input, max);
    if (type === 'teams') return this.searchTeams(input, max);
    return this.searchProjects(input, max);
  }

  private async searchPeople(input: SearchInput, max: number): Promise<Candidate[]> {
    const filter: FilterQuery<UserDocument> = {
      accountState: 'ACTIVE',
      'preferences.privacy.profileDiscoverable': { $ne: false },
      _id: { $nin: input.context.blockedUserIds },
      ...textFilter(PERSON_FIELDS, input.query, input.prefix),
    };
    if (input.filters.college)
      filter.college = exactFilter('college', input.filters.college).college;
    if (input.filters.course) filter.course = exactFilter('course', input.filters.course).course;
    if (input.filters.skill)
      filter.skills = { $regex: escapeRegExp(input.filters.skill), $options: 'i' };
    if (input.filters.verifiedOnly) filter.verificationStatus = 'VERIFIED';
    const users = this.useAtlas
      ? await this.atlasDocuments(
          UserModel as unknown as AtlasModel,
          filter,
          PERSON_FIELDS,
          input,
          max,
        )
      : undefined;
    const documents = (users ??
      (await UserModel.find(filter)
        .select(
          'username displayName bio college department course skills interests goals avatarUrl verificationStatus createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(max)
        .lean()
        .exec())) as unknown as Array<
      Pick<
        UserDocument,
        | 'id'
        | 'username'
        | 'displayName'
        | 'bio'
        | 'college'
        | 'department'
        | 'course'
        | 'skills'
        | 'interests'
        | 'goals'
        | 'avatarUrl'
        | 'verificationStatus'
        | 'createdAt'
      >
    >;
    const candidates = documents.map((user) => this.personCandidate(user, input.query));
    return this.useAtlas ? this.applyAtlasScores(candidates, users ?? []) : candidates;
  }

  private async searchCommunities(input: SearchInput, max: number): Promise<Candidate[]> {
    const visibility: Record<string, unknown>[] = [{ privacy: 'PUBLIC' }];
    if (input.context.actorCollege)
      visibility.push({
        privacy: 'CAMPUS',
        $or: [{ collegeId: input.context.actorCollege }, { collegeId: { $exists: false } }],
      });
    visibility.push({
      privacy: 'PRIVATE',
      $or: [{ ownerId: input.context.actorId }, { _id: { $in: input.context.communityMemberIds } }],
    });
    const filter: FilterQuery<CommunityDocument> = {
      status: 'ACTIVE',
      $and: [{ $or: visibility }, textFilter(COMMUNITY_FIELDS, input.query, input.prefix)],
    };
    if (input.filters.college)
      filter.collegeId = exactFilter('collegeId', input.filters.college).collegeId;
    if (input.filters.category)
      filter.category = exactFilter('category', input.filters.category).category;
    if (input.filters.visibility) filter.privacy = input.filters.visibility;
    const communities = this.useAtlas
      ? await this.atlasDocuments(
          CommunityModel as unknown as AtlasModel,
          filter,
          COMMUNITY_FIELDS,
          input,
          max,
        )
      : undefined;
    const documents = (communities ??
      (await CommunityModel.find(filter)
        .select('name description category collegeId privacy status createdAt')
        .sort({ createdAt: -1, _id: -1 })
        .limit(max)
        .lean()
        .exec())) as unknown as Array<
      Pick<
        CommunityDocument,
        | 'id'
        | 'name'
        | 'description'
        | 'category'
        | 'collegeId'
        | 'privacy'
        | 'status'
        | 'createdAt'
      >
    >;
    const candidates = documents.map((item) => this.communityCandidate(item, input.query));
    return this.useAtlas ? this.applyAtlasScores(candidates, communities ?? []) : candidates;
  }

  private async searchTeams(input: SearchInput, max: number): Promise<Candidate[]> {
    const visibility: Record<string, unknown>[] = [
      { visibility: { $in: ['PUBLIC', 'CAMPUS'] } },
      {
        visibility: 'PRIVATE',
        $or: [{ ownerId: input.context.actorId }, { _id: { $in: input.context.teamMemberIds } }],
      },
    ];
    const filter: FilterQuery<TeamDocument> = {
      status: { $ne: 'ARCHIVED' },
      $and: [{ $or: visibility }, textFilter(TEAM_FIELDS, input.query, input.prefix)],
    };
    if (input.filters.communityId) filter.communityId = input.filters.communityId;
    if (input.filters.projectId) filter.projectId = input.filters.projectId;
    if (input.filters.teamStatus) filter.status = input.filters.teamStatus;
    if (input.filters.visibility) filter.visibility = input.filters.visibility;
    const teams = this.useAtlas
      ? await this.atlasDocuments(
          TeamModel as unknown as AtlasModel,
          filter,
          TEAM_FIELDS,
          input,
          max,
        )
      : undefined;
    const documents = (teams ??
      (await TeamModel.find(filter)
        .select(
          'name description ownerId projectId communityId status maxMembers visibility createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(max)
        .lean()
        .exec())) as unknown as Array<
      Pick<
        TeamDocument,
        | 'id'
        | 'name'
        | 'description'
        | 'projectId'
        | 'communityId'
        | 'status'
        | 'maxMembers'
        | 'visibility'
        | 'createdAt'
      >
    >;
    const candidates = documents.map((item) => this.teamCandidate(item, input.query));
    return this.useAtlas ? this.applyAtlasScores(candidates, teams ?? []) : candidates;
  }

  private async searchProjects(input: SearchInput, max: number): Promise<Candidate[]> {
    const visibility: Record<string, unknown>[] = [
      { visibility: { $in: ['PUBLIC', 'CAMPUS'] } },
      {
        visibility: 'CONNECTIONS',
        $or: [
          { ownerId: input.context.actorId },
          { ownerId: { $in: input.context.connectedUserIds } },
          { _id: { $in: input.context.projectMemberIds } },
        ],
      },
      {
        visibility: 'PRIVATE',
        $or: [{ ownerId: input.context.actorId }, { _id: { $in: input.context.projectMemberIds } }],
      },
    ];
    const filter: FilterQuery<ProjectDocument> = {
      status: { $ne: 'ARCHIVED' },
      $and: [{ $or: visibility }, textFilter(PROJECT_FIELDS, input.query, input.prefix)],
    };
    if (input.filters.projectStatus) filter.status = input.filters.projectStatus;
    if (input.filters.visibility) filter.visibility = input.filters.visibility;
    if (input.filters.skill)
      filter.technologies = { $regex: escapeRegExp(input.filters.skill), $options: 'i' };
    const projects = this.useAtlas
      ? await this.atlasDocuments(
          ProjectModel as unknown as AtlasModel,
          filter,
          PROJECT_FIELDS,
          input,
          max,
        )
      : undefined;
    const documents = (projects ??
      (await ProjectModel.find(filter)
        .select(
          'name description ownerTeamId ownerId status visibility technologies coverImageUrl showcaseEnabled createdAt',
        )
        .sort({ createdAt: -1, _id: -1 })
        .limit(max)
        .lean()
        .exec())) as unknown as Array<
      Pick<
        ProjectDocument,
        | 'id'
        | 'name'
        | 'description'
        | 'ownerTeamId'
        | 'status'
        | 'visibility'
        | 'technologies'
        | 'coverImageUrl'
        | 'showcaseEnabled'
        | 'createdAt'
      >
    >;
    const candidates = documents.map((item) => this.projectCandidate(item, input.query));
    return this.useAtlas ? this.applyAtlasScores(candidates, projects ?? []) : candidates;
  }

  protected async atlasDocuments(
    model: AtlasModel,
    filter: object,
    paths: string[],
    input: SearchInput,
    max: number,
  ): Promise<AtlasDocument[]> {
    const searchClause = input.prefix
      ? { autocomplete: { query: input.query, path: paths } }
      : {
          compound: {
            should: paths.map((path) => ({ text: { query: input.query, path } })),
            minimumShouldMatch: 1,
          },
        };
    const rows = await model
      .aggregate([
        { $search: { index: this.env.SEARCH_ATLAS_INDEX, ...searchClause } },
        { $match: filter },
        { $project: { _id: 1, searchScore: { $meta: 'searchScore' } } },
        { $limit: max },
      ])
      .exec();
    const ids = rows.map((row) => String((row as { _id: unknown })._id));
    if (!ids.length) return [];
    const documents = await model
      .find({ ...filter, _id: { $in: ids } })
      .select(
        'username displayName bio college department course skills interests goals avatarUrl verificationStatus name description category collegeId privacy status ownerId projectId communityId maxMembers visibility ownerTeamId technologies coverImageUrl showcaseEnabled createdAt',
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(max)
      .lean()
      .exec();
    const scores = new Map(
      rows.map((row) => [
        String((row as { _id: unknown })._id),
        Number((row as { searchScore?: number }).searchScore ?? 0),
      ]),
    );
    return documents.map((document) =>
      Object.assign(document, {
        id: String(document._id),
        __searchScore: scores.get(String(document._id)) ?? 0,
      }),
    );
  }

  private applyAtlasScores(
    candidates: Candidate[],
    documents: Array<{ _id: unknown; __searchScore: number }>,
  ): Candidate[] {
    const scores = new Map(
      documents.map((document) => [String(document._id), document.__searchScore ?? 0]),
    );
    return candidates.map((candidate) => {
      const score = scores.get(candidate.result.id);
      if (score !== undefined) candidate.result.score = score;
      return candidate;
    });
  }

  private personCandidate(
    item: Pick<
      UserDocument,
      | 'id'
      | 'username'
      | 'displayName'
      | 'bio'
      | 'college'
      | 'department'
      | 'course'
      | 'skills'
      | 'interests'
      | 'goals'
      | 'avatarUrl'
      | 'verificationStatus'
      | 'createdAt'
    >,
    query: string,
  ): Candidate {
    const result: SearchResult = {
      id: searchDocumentId(item),
      type: 'person',
      title: item.displayName,
      ...(item.bio ? { snippet: item.bio } : {}),
      ...(item.avatarUrl ? { imageUrl: item.avatarUrl } : {}),
      metadata: {
        username: item.username,
        college: item.college,
        course: item.course,
        skills: item.skills,
        verificationStatus: item.verificationStatus,
      },
      score: scoreFor(
        [
          { value: item.username, weight: 8 },
          { value: item.displayName, weight: 7 },
          { value: item.skills, weight: 5 },
          { value: item.interests, weight: 4 },
          { value: item.bio, weight: 2 },
        ],
        query,
      ),
      highlights: highlight('displayName', item.displayName, query),
    };
    return { result, createdAt: item.createdAt };
  }
  private communityCandidate(
    item: Pick<
      CommunityDocument,
      'id' | 'name' | 'description' | 'category' | 'collegeId' | 'privacy' | 'status' | 'createdAt'
    >,
    query: string,
  ): Candidate {
    const result: SearchResult = {
      id: searchDocumentId(item),
      type: 'community',
      title: item.name,
      snippet: item.description,
      metadata: {
        category: item.category,
        college: item.collegeId,
        visibility: item.privacy,
        status: item.status,
      },
      score: scoreFor(
        [
          { value: item.name, weight: 8 },
          { value: item.category, weight: 5 },
          { value: item.description, weight: 2 },
        ],
        query,
      ),
      highlights: highlight('name', item.name, query),
    };
    return { result, createdAt: item.createdAt };
  }
  private teamCandidate(
    item: Pick<
      TeamDocument,
      | 'id'
      | 'name'
      | 'description'
      | 'projectId'
      | 'communityId'
      | 'status'
      | 'maxMembers'
      | 'visibility'
      | 'createdAt'
    >,
    query: string,
  ): Candidate {
    const result: SearchResult = {
      id: searchDocumentId(item),
      type: 'team',
      title: item.name,
      snippet: item.description,
      metadata: {
        projectId: item.projectId?.toString(),
        communityId: item.communityId?.toString(),
        status: item.status,
        visibility: item.visibility,
        maxMembers: item.maxMembers,
      },
      score: scoreFor(
        [
          { value: item.name, weight: 8 },
          { value: item.description, weight: 2 },
        ],
        query,
      ),
      highlights: highlight('name', item.name, query),
    };
    return { result, createdAt: item.createdAt };
  }
  private projectCandidate(
    item: Pick<
      ProjectDocument,
      | 'id'
      | 'name'
      | 'description'
      | 'ownerTeamId'
      | 'status'
      | 'visibility'
      | 'technologies'
      | 'coverImageUrl'
      | 'showcaseEnabled'
      | 'createdAt'
    >,
    query: string,
  ): Candidate {
    const result: SearchResult = {
      id: searchDocumentId(item),
      type: 'project',
      title: item.name,
      snippet: item.description,
      ...(item.coverImageUrl ? { imageUrl: item.coverImageUrl } : {}),
      metadata: {
        ownerTeamId: item.ownerTeamId?.toString(),
        status: item.status,
        visibility: item.visibility,
        technologies: item.technologies,
        showcaseEnabled: item.showcaseEnabled,
      },
      score: scoreFor(
        [
          { value: item.name, weight: 8 },
          { value: item.technologies, weight: 6 },
          { value: item.description, weight: 2 },
        ],
        query,
      ),
      highlights: highlight('name', item.name, query),
    };
    return { result, createdAt: item.createdAt };
  }
}

export class AtlasSearchProvider extends MongoSearchProvider {
  // Atlas Search syntax is isolated in MongoSearchProvider.atlasDocuments.
  // Local development uses the deterministic MongoDB fallback instead.
  protected override readonly useAtlas: boolean = true;
  public readonly provider = 'mongodb-atlas-search';
}

export function createSearchProvider(): SearchProvider {
  return getEnv().SEARCH_PROVIDER === 'atlas'
    ? new AtlasSearchProvider()
    : new MongoSearchProvider();
}
