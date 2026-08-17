import { Types, type ClientSession } from 'mongoose';
import type { Express } from 'express';
import type {
  ApiCollection,
  ConnectionState,
  EventType,
  FeedRankingMetadata,
  PostType,
  ReactionTargetType,
  ReactionType,
  Visibility,
} from '@campusconnection/shared';
import { decodeCursor, encodeCursor } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { OutboxEventPublisher } from '../../../infrastructure/events/event-publisher';
import { UserRepository } from '../../identity/infrastructure/identity.repositories';
import {
  CommentRepository,
  ConnectionRepository,
  PostRepository,
  ReactionRepository,
  BlockRepository,
} from '../infrastructure/social.repositories';
import {
  CommentModel,
  ConnectionModel,
  type CommentDocument,
  type ConnectionDocument,
  type PostDocument,
} from '../infrastructure/social.models';
import {
  assertActiveActor,
  assertCommentOwner,
  assertPostOwner,
  canViewVisibility,
} from './social.policy';
import { withMongoTransaction } from './social.transaction';
import { MediaAssetRepository } from '../../../infrastructure/media/media.repository';
import {
  CloudinaryMediaStorage,
  type MediaStorage,
  type UploadedMedia,
} from '../../../infrastructure/media/media-storage';
import {
  CommunityMemberModel,
  CommunityModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { FeedRankingService } from '../../intelligence/application/feed-ranking.service';
import { loadRecommendationContext } from '../../intelligence/application/candidate-generators';

interface CursorInput {
  limit: number;
  cursor?: string;
  mode?: 'personalized' | 'chronological';
}
interface Actor {
  userId: string;
  accountState: string;
}
interface SocialDependencies {
  posts?: PostRepository;
  comments?: CommentRepository;
  reactions?: ReactionRepository;
  connections?: ConnectionRepository;
  blocks?: BlockRepository;
  users?: UserRepository;
  events?: OutboxEventPublisher;
  mediaStorage?: MediaStorage;
  mediaAssets?: MediaAssetRepository;
}

export class SocialService {
  private readonly posts: PostRepository;
  private readonly comments: CommentRepository;
  private readonly reactions: ReactionRepository;
  private readonly connections: ConnectionRepository;
  private readonly blocks: BlockRepository;
  private readonly users: UserRepository;
  private readonly events: OutboxEventPublisher;
  private readonly feedRanking: FeedRankingService;
  private readonly mediaStorage: MediaStorage;
  private readonly mediaAssets: MediaAssetRepository;
  public constructor(dependencies: SocialDependencies = {}) {
    this.posts = dependencies.posts ?? new PostRepository();
    this.comments = dependencies.comments ?? new CommentRepository();
    this.reactions = dependencies.reactions ?? new ReactionRepository();
    this.connections = dependencies.connections ?? new ConnectionRepository();
    this.blocks = dependencies.blocks ?? new BlockRepository();
    this.users = dependencies.users ?? new UserRepository();
    this.events = dependencies.events ?? new OutboxEventPublisher();
    this.feedRanking = new FeedRankingService();
    this.mediaStorage = dependencies.mediaStorage ?? new CloudinaryMediaStorage();
    this.mediaAssets = dependencies.mediaAssets ?? new MediaAssetRepository();
  }

  private actorId(actor: Actor) {
    return new Types.ObjectId(actor.userId);
  }
  private cursorFilter(cursor?: string): Record<string, unknown> {
    if (!cursor) return {};
    try {
      const position = decodeCursor(cursor);
      if (!Types.ObjectId.isValid(position.id)) throw new Error('invalid id');
      const createdAt = new Date(position.createdAt);
      if (Number.isNaN(createdAt.valueOf())) throw new Error('invalid date');
      return {
        $or: [
          { createdAt: { $lt: createdAt } },
          { createdAt, _id: { $lt: new Types.ObjectId(position.id) } },
        ],
      };
    } catch {
      throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
    }
  }
  private async author(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new AppError('RESOURCE_NOT_FOUND', 'The user was not found.', 404);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }
  private async assertCanViewPost(actor: Actor, post: PostDocument) {
    if (post.communityId) {
      const community = await CommunityModel.findById(post.communityId)
        .select('status ownerId')
        .lean()
        .exec();
      const member = await CommunityMemberModel.findOne({
        communityId: post.communityId,
        userId: actor.userId,
        status: 'ACTIVE',
      })
        .lean()
        .exec();
      if (
        !community ||
        community.status !== 'ACTIVE' ||
        (!member && community.ownerId.toString() !== actor.userId)
      )
        throw new AppError('FORBIDDEN', 'Active community membership is required.', 403);
      return;
    }
    if (post.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    if (await this.blocks.eitherBlocked(actor.userId, post.authorId.toString()))
      throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    const connected = Boolean(
      await this.connections.areConnected(actor.userId, post.authorId.toString()),
    );
    if (!canViewVisibility(actor.userId, post.authorId.toString(), post.visibility, connected))
      throw new AppError('FORBIDDEN', 'You cannot view this post.', 403);
  }
  private async postView(actor: Actor, post: PostDocument, ranking?: FeedRankingMetadata) {
    const [author, reactionCount, commentCount, viewerHasReacted, mediaAssets] = await Promise.all([
      this.author(post.authorId.toString()),
      this.reactions.count('POST', post._id),
      this.commentsCount(post._id),
      this.reactions.has(this.actorId(actor), 'POST', post._id),
      this.mediaAssets.listByIds(post.mediaAssetIds ?? []),
    ]);
    return {
      id: post.id,
      author,
      type: post.type,
      content: post.content,
      tags: post.tags,
      ...(post.link ? { link: post.link } : {}),
      ...(post.communityId ? { communityId: post.communityId.toString() } : {}),
      visibility: post.visibility,
      mediaAssetIds: post.mediaAssetIds,
      media: mediaAssets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        type: asset.type,
        ...(typeof asset.width === 'number' ? { width: asset.width } : {}),
        ...(typeof asset.height === 'number' ? { height: asset.height } : {}),
        ...(typeof asset.bytes === 'number' ? { bytes: asset.bytes } : {}),
      })),
      status: post.status,
      reactionCount,
      commentCount,
      viewerHasReacted: Boolean(viewerHasReacted),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      ...(ranking ? { ranking } : {}),
    };
  }
  private async commentsCount(postId: Types.ObjectId) {
    return CommentModel.countDocuments({
      postId,
      status: 'ACTIVE',
    }).exec();
  }
  private async commentView(actor: Actor, comment: CommentDocument) {
    const [author, reactionCount, viewerHasReacted] = await Promise.all([
      this.author(comment.authorId.toString()),
      this.reactions.count('COMMENT', comment._id),
      this.reactions.has(this.actorId(actor), 'COMMENT', comment._id),
    ]);
    return {
      id: comment.id,
      postId: comment.postId.toString(),
      author,
      content: comment.content,
      ...(comment.parentCommentId ? { parentCommentId: comment.parentCommentId.toString() } : {}),
      reactionCount,
      viewerHasReacted: Boolean(viewerHasReacted),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };
  }
  private async record(
    eventType: EventType,
    aggregateType: string,
    aggregateId: string,
    actorId: string,
    correlationId: string,
    payload: Record<string, unknown>,
    session: ClientSession,
  ) {
    await this.events.record(
      {
        eventType,
        producer: 'social',
        aggregateType,
        aggregateId,
        actorId,
        correlationId,
        payload,
      },
      session,
    );
  }

  async createPost(
    actor: Actor,
    input: {
      type: PostType;
      content: string;
      tags: string[];
      communityId?: string | undefined;
      link?: string | undefined;
      visibility: Visibility;
      mediaAssetIds: string[];
    },
    correlationId: string,
    files: Express.Multer.File[] = [],
  ) {
    assertActiveActor(actor.accountState);
    if (input.communityId) {
      const community = await CommunityModel.findById(input.communityId)
        .select('status ownerId')
        .lean()
        .exec();
      const member = await CommunityMemberModel.findOne({
        communityId: input.communityId,
        userId: actor.userId,
        status: 'ACTIVE',
      })
        .lean()
        .exec();
      if (
        !community ||
        community.status !== 'ACTIVE' ||
        (!member && community.ownerId.toString() !== actor.userId)
      )
        throw new AppError('FORBIDDEN', 'Active community membership is required.', 403);
    }
    if (input.visibility === 'COMMUNITY')
      throw new AppError(
        'COMMUNITY_NOT_AVAILABLE',
        'Community visibility is not available yet.',
        422,
      );
    if (input.mediaAssetIds.length) {
      throw new AppError(
        'MEDIA_UPLOAD_REQUIRED',
        'Images must be uploaded with the post request.',
        422,
      );
    }
    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 10);
    const uploaded: UploadedMedia[] = files.length
      ? await Promise.all(files.map((file) => this.mediaStorage.uploadImage(file)))
      : [];
    try {
      const post = await withMongoTransaction(async (session) => {
        const created = await this.posts.create(
          {
            authorId: this.actorId(actor),
            type: input.type,
            content: input.content.trim(),
            tags,
            ...(input.link ? { link: input.link.trim() } : {}),
            ...(input.communityId ? { communityId: new Types.ObjectId(input.communityId) } : {}),
            visibility: input.visibility,
            mediaAssetIds: [],
            status: 'ACTIVE',
          },
          session,
        );
        const mediaAssetIds = await Promise.all(
          uploaded.map(async (asset) => {
            const media = await this.mediaAssets.create(
              { ...asset, ownerId: actor.userId, postId: created.id },
              session,
            );
            return media.id;
          }),
        );
        const saved = mediaAssetIds.length
          ? await this.posts.update(created.id, { mediaAssetIds }, session)
          : created;
        if (!saved) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
        await this.record(
          'POST_CREATED',
          'POST',
          saved.id,
          actor.userId,
          correlationId,
          {
            postId: saved.id,
            postType: saved.type,
            visibility: saved.visibility,
            mediaCount: mediaAssetIds.length,
          },
          session,
        );
        return saved;
      });
      return this.postView(actor, post);
    } catch (error) {
      await Promise.allSettled(
        uploaded.map((asset) => this.mediaStorage.deleteImage(asset.publicId)),
      );
      throw error;
    }
  }
  async getPost(actor: Actor, postId: string) {
    const post = await this.posts.findById(postId);
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    await this.assertCanViewPost(actor, post);
    return this.postView(actor, post);
  }
  async listUserPosts(actor: Actor, userId: string, input: { limit: number; cursor?: string }) {
    const target = await this.users.findById(userId);
    if (!target || ['BANNED', 'DELETED', 'SUSPENDED'].includes(target.accountState))
      throw new AppError('RESOURCE_NOT_FOUND', 'The profile was not found.', 404);
    const posts = await this.posts.list(
      {
        authorId: new Types.ObjectId(userId),
        status: 'ACTIVE',
        ...this.cursorFilter(input.cursor),
      },
      input.limit + 1,
    );
    const visible: Array<Awaited<ReturnType<SocialService['postView']>>> = [];
    for (const post of posts) {
      try {
        await this.assertCanViewPost(actor, post);
        visible.push(await this.postView(actor, post));
      } catch (error) {
        if (error instanceof AppError && ['FORBIDDEN', 'RESOURCE_NOT_FOUND'].includes(error.code))
          continue;
        throw error;
      }
      if (visible.length >= input.limit) break;
    }
    const last = visible[visible.length - 1];
    return {
      data: visible,
      pagination: {
        hasMore: posts.length > input.limit,
        nextCursor:
          posts.length > input.limit && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }
  async listCommunityPosts(
    actor: Actor,
    communityId: string,
    input: { limit: number; cursor?: string },
  ) {
    const community = await CommunityModel.findById(communityId)
      .select('status ownerId')
      .lean()
      .exec();
    const member = await CommunityMemberModel.findOne({
      communityId,
      userId: actor.userId,
      status: 'ACTIVE',
    })
      .lean()
      .exec();
    if (!community || community.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The community was not found.', 404);
    if (!member && community.ownerId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Active community membership is required.', 403);
    const posts = await this.posts.list(
      {
        communityId: new Types.ObjectId(communityId),
        status: 'ACTIVE',
        ...this.cursorFilter(input.cursor),
      },
      input.limit + 1,
    );
    const data = await Promise.all(
      posts.slice(0, input.limit).map((post) => this.postView(actor, post)),
    );
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        hasMore: posts.length > input.limit,
        nextCursor:
          posts.length > input.limit && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }
  async updatePost(
    actor: Actor,
    postId: string,
    input: Partial<{
      type: PostType;
      content: string;
      tags: string[];
      link?: string;
      visibility: Visibility;
      mediaAssetIds: string[];
    }>,
    correlationId: string,
  ) {
    assertActiveActor(actor.accountState);
    if (input.visibility === 'COMMUNITY')
      throw new AppError(
        'COMMUNITY_NOT_AVAILABLE',
        'Community visibility is not available yet.',
        422,
      );
    const existing = await this.posts.findById(postId);
    if (!existing) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    assertPostOwner(actor.userId, existing);
    const post = await withMongoTransaction(async (session) => {
      const updated = await this.posts.update(postId, input, session);
      if (!updated) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
      await this.record(
        'POST_UPDATED',
        'POST',
        updated.id,
        actor.userId,
        correlationId,
        { postId: updated.id },
        session,
      );
      return updated;
    });
    return this.postView(actor, post);
  }
  async deletePost(actor: Actor, postId: string, correlationId: string) {
    assertActiveActor(actor.accountState);
    const existing = await this.posts.findById(postId);
    if (!existing) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    assertPostOwner(actor.userId, existing);
    const mediaAssets = await this.mediaAssets.listByIds(existing.mediaAssetIds ?? []);
    await withMongoTransaction(async (session) => {
      const deleted = await this.posts.softDelete(postId, this.actorId(actor), session);
      if (!deleted) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
      await this.mediaAssets.markOrphanedByPost(postId, session);
      await this.record(
        'POST_DELETED',
        'POST',
        postId,
        actor.userId,
        correlationId,
        { postId },
        session,
      );
    });
    await Promise.allSettled(
      mediaAssets.map((asset) => this.mediaStorage.deleteImage(asset.publicId)),
    );
  }

  async listFeed(
    actor: Actor,
    input: CursorInput,
  ): Promise<ApiCollection<Awaited<ReturnType<SocialService['postView']>>>> {
    const limit = input.limit;
    const mode = input.mode ?? 'personalized';
    const context = await loadRecommendationContext(actor.userId, this.blocks);
    const connectedIds = context.connectedIds;
    const candidateLimit =
      mode === 'personalized' ? Math.min(250, Math.max(50, limit * 5 + 20)) : limit + 1;
    const posts = await this.posts.list(
      {
        status: 'ACTIVE',
        communityId: null,
        ...(mode === 'chronological' ? this.cursorFilter(input.cursor) : {}),
        $or: [
          { visibility: { $in: ['PUBLIC', 'CAMPUS'] } },
          { authorId: this.actorId(actor) },
          ...(connectedIds.length
            ? [{ authorId: { $in: connectedIds }, visibility: 'CONNECTIONS' }]
            : []),
        ],
      },
      candidateLimit,
    );
    if (mode === 'chronological') {
      const visible = [];
      for (const post of posts) {
        if (visible.length >= limit) break;
        if (!context.blockedIds.includes(post.authorId.toString()))
          visible.push(await this.postView(actor, post));
      }
      const hasMore = posts.length > limit || visible.length < posts.length;
      const last = visible[visible.length - 1];
      return {
        data: visible,
        pagination: {
          hasMore,
          nextCursor:
            hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
        },
      };
    }
    const ranked = (await this.feedRanking.rank(posts, context)).filter(
      (item) => !context.blockedIds.includes(item.post.authorId.toString()),
    );
    let cursor: { score: number; id: string } | undefined;
    if (input.cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')) as {
          score?: number;
          id?: string;
          version?: string;
        };
        if (
          parsed.version !== 'recommendation-v1' ||
          typeof parsed.score !== 'number' ||
          typeof parsed.id !== 'string'
        )
          throw new Error();
        cursor = { score: parsed.score, id: parsed.id };
      } catch {
        throw new AppError('INVALID_CURSOR', 'The feed cursor is invalid.', 400);
      }
    }
    const after = cursor
      ? ranked.filter(
          (item) =>
            item.ranking.score < cursor!.score ||
            (item.ranking.score === cursor!.score && item.post.id < cursor!.id),
        )
      : ranked;
    const page = after.slice(0, limit + 1);
    const data = await Promise.all(
      page.slice(0, limit).map((item) => this.postView(actor, item.post, item.ranking)),
    );
    const last = page[limit - 1];
    return {
      data,
      pagination: {
        hasMore: page.length > limit,
        nextCursor:
          page.length > limit && last
            ? Buffer.from(
                JSON.stringify({
                  score: last.ranking.score,
                  id: last.post.id,
                  version: 'recommendation-v1',
                }),
                'utf8',
              ).toString('base64url')
            : null,
      },
    };
  }

  async createComment(
    actor: Actor,
    postId: string,
    input: { content: string; parentCommentId?: string },
    correlationId: string,
  ) {
    assertActiveActor(actor.accountState);
    const post = await this.posts.findById(postId);
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    await this.assertCanViewPost(actor, post);
    if (input.parentCommentId) {
      const parent = await this.comments.findById(input.parentCommentId);
      if (!parent || parent.postId.toString() !== postId || parent.status !== 'ACTIVE')
        throw new AppError('RESOURCE_NOT_FOUND', 'The parent comment was not found.', 404);
    }
    const comment = await withMongoTransaction(async (session) => {
      const created = await this.comments.create(
        {
          postId: new Types.ObjectId(postId),
          authorId: this.actorId(actor),
          content: input.content,
          ...(input.parentCommentId
            ? { parentCommentId: new Types.ObjectId(input.parentCommentId) }
            : {}),
        },
        session,
      );
      await this.record(
        'COMMENT_CREATED',
        'COMMENT',
        created.id,
        actor.userId,
        correlationId,
        { commentId: created.id, postId },
        session,
      );
      return created;
    });
    return this.commentView(actor, comment);
  }
  async listComments(
    actor: Actor,
    postId: string,
    input: CursorInput,
  ): Promise<ApiCollection<Awaited<ReturnType<SocialService['commentView']>>>> {
    const post = await this.posts.findById(postId);
    if (!post) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
    await this.assertCanViewPost(actor, post);
    const comments = await this.comments.list(
      { postId, status: 'ACTIVE', ...this.cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const page = comments.slice(0, input.limit);
    return {
      data: await Promise.all(page.map((comment) => this.commentView(actor, comment))),
      pagination: {
        hasMore: comments.length > input.limit,
        nextCursor:
          comments.length > input.limit && page[page.length - 1]
            ? encodeCursor({
                createdAt: page[page.length - 1]!.createdAt.toISOString(),
                id: page[page.length - 1]!.id,
              })
            : null,
      },
    };
  }
  async updateComment(actor: Actor, commentId: string, content: string) {
    assertActiveActor(actor.accountState);
    const comment = await this.comments.findById(commentId);
    if (!comment || comment.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The comment was not found.', 404);
    assertCommentOwner(actor.userId, comment);
    const updated = await this.comments.update(commentId, { content });
    if (!updated) throw new AppError('RESOURCE_NOT_FOUND', 'The comment was not found.', 404);
    return this.commentView(actor, updated);
  }
  async deleteComment(actor: Actor, commentId: string, correlationId: string) {
    assertActiveActor(actor.accountState);
    const comment = await this.comments.findById(commentId);
    if (!comment || comment.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The comment was not found.', 404);
    assertCommentOwner(actor.userId, comment);
    await withMongoTransaction(async (session) => {
      await this.comments.softDelete(commentId, this.actorId(actor), session);
      await this.record(
        'COMMENT_DELETED',
        'COMMENT',
        commentId,
        actor.userId,
        correlationId,
        { commentId, postId: comment.postId.toString() },
        session,
      );
    });
  }

  async setReaction(
    actor: Actor,
    targetType: ReactionTargetType,
    targetId: string,
    reactionType: ReactionType,
    add: boolean,
    correlationId: string,
  ) {
    assertActiveActor(actor.accountState);
    if (targetType === 'POST') await this.getPost(actor, targetId);
    else {
      const comment = await this.comments.findById(targetId);
      if (!comment || comment.status !== 'ACTIVE')
        throw new AppError('RESOURCE_NOT_FOUND', 'The comment was not found.', 404);
      const post = await this.posts.findById(comment.postId.toString());
      if (!post) throw new AppError('RESOURCE_NOT_FOUND', 'The post was not found.', 404);
      await this.assertCanViewPost(actor, post);
    }
    await withMongoTransaction(async (session) => {
      const existing = await this.reactions.find(
        this.actorId(actor),
        targetType,
        targetId,
        reactionType,
        session,
      );
      if (add && !existing) {
        await this.reactions.add(
          {
            userId: this.actorId(actor),
            targetType,
            targetId: new Types.ObjectId(targetId),
            reactionType,
          },
          session,
        );
        await this.record(
          'REACTION_ADDED',
          'REACTION',
          targetId,
          actor.userId,
          correlationId,
          { targetType, targetId, reactionType },
          session,
        );
      } else if (!add && existing) {
        await this.reactions.remove(
          this.actorId(actor),
          targetType,
          targetId,
          reactionType,
          session,
        );
        await this.record(
          'REACTION_REMOVED',
          'REACTION',
          targetId,
          actor.userId,
          correlationId,
          { targetType, targetId, reactionType },
          session,
        );
      }
    });
  }

  private counterpart(connection: ConnectionDocument, actorId: string) {
    return connection.userAId.toString() === actorId
      ? connection.userBId.toString()
      : connection.userAId.toString();
  }
  async requestConnection(actor: Actor, targetId: string, correlationId: string) {
    assertActiveActor(actor.accountState);
    if (actor.userId === targetId)
      throw new AppError('INVALID_CONNECTION', 'You cannot connect with yourself.', 422);
    if (!(await this.users.findById(targetId)))
      throw new AppError('RESOURCE_NOT_FOUND', 'The user was not found.', 404);
    if (await this.blocks.eitherBlocked(actor.userId, targetId))
      throw new AppError('FORBIDDEN', 'This connection is not available.', 403);
    const connection = await this.connections.findPair(actor.userId, targetId);
    if (connection?.state === 'PENDING' || connection?.state === 'ACCEPTED')
      throw new AppError('CONNECTION_EXISTS', 'A connection already exists.', 409);
    let saved: ConnectionDocument;
    try {
      saved = await withMongoTransaction(async (session) => {
        const result = await this.connections.savePair(
          actor.userId,
          targetId,
          { requestedBy: this.actorId(actor), state: 'PENDING' },
          session,
        );
        if (!result) throw new Error('Connection save returned no document');
        await this.record(
          'CONNECTION_REQUESTED',
          'CONNECTION',
          result.id,
          actor.userId,
          correlationId,
          { connectionId: result.id, targetUserId: targetId },
          session,
        );
        return result;
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
        throw new AppError('CONNECTION_EXISTS', 'A connection already exists.', 409);
      throw error;
    }
    return this.connectionView(saved, actor.userId);
  }
  async respondConnection(
    actor: Actor,
    requestId: string,
    accepted: boolean,
    correlationId: string,
  ) {
    assertActiveActor(actor.accountState);
    const connection = await ConnectionModel.findById(requestId).exec();
    if (!connection || connection.state !== 'PENDING')
      throw new AppError('RESOURCE_NOT_FOUND', 'The connection request was not found.', 404);
    if (connection.requestedBy.toString() === actor.userId)
      throw new AppError('FORBIDDEN', 'The requester cannot respond to this request.', 403);
    if (
      connection.userAId.toString() !== actor.userId &&
      connection.userBId.toString() !== actor.userId
    )
      throw new AppError('FORBIDDEN', 'You cannot respond to this request.', 403);
    const state: ConnectionState = accepted ? 'ACCEPTED' : 'REJECTED';
    const saved = await withMongoTransaction(async (session) => {
      const result = await ConnectionModel.findByIdAndUpdate(
        requestId,
        { $set: { state, respondedAt: new Date() } },
        { new: true, session },
      ).exec();
      if (!result)
        throw new AppError('RESOURCE_NOT_FOUND', 'The connection request was not found.', 404);
      await this.record(
        accepted ? 'CONNECTION_ACCEPTED' : 'CONNECTION_REJECTED',
        'CONNECTION',
        requestId,
        actor.userId,
        correlationId,
        { connectionId: requestId },
        session,
      );
      return result;
    });
    return this.connectionView(saved, actor.userId);
  }
  async removeConnection(actor: Actor, targetId: string, correlationId: string) {
    const saved = await withMongoTransaction(async (session) => {
      const result = await this.connections.removeForUser(actor.userId, targetId, session);
      if (result)
        await this.record(
          'CONNECTION_REMOVED',
          'CONNECTION',
          result.id,
          actor.userId,
          correlationId,
          { connectionId: result.id, targetUserId: targetId },
          session,
        );
      return result;
    });
    if (!saved) throw new AppError('RESOURCE_NOT_FOUND', 'The connection was not found.', 404);
  }
  private connectionView(connection: ConnectionDocument, actorId: string) {
    return {
      id: connection.id,
      userId: this.counterpart(connection, actorId),
      state: connection.state,
      requestedBy: connection.requestedBy.toString(),
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }
  async listConnections(
    actor: Actor,
    state: ConnectionState | ConnectionState[],
    input: CursorInput,
  ) {
    const list = await this.connections.listForUser(
      actor.userId,
      state,
      input.limit + 1,
      this.cursorFilter(input.cursor),
    );
    const page = list.slice(0, input.limit);
    return {
      data: page.map((item) => this.connectionView(item, actor.userId)),
      pagination: {
        hasMore: list.length > input.limit,
        nextCursor:
          list.length > input.limit && page[page.length - 1]
            ? encodeCursor({
                createdAt: page[page.length - 1]!.createdAt.toISOString(),
                id: page[page.length - 1]!.id,
              })
            : null,
      },
    };
  }
  async listRequests(actor: Actor, direction: 'incoming' | 'outgoing', input: CursorInput) {
    const list =
      direction === 'incoming'
        ? await this.connections.incoming(
            actor.userId,
            input.limit + 1,
            this.cursorFilter(input.cursor),
          )
        : await this.connections.outgoing(
            actor.userId,
            input.limit + 1,
            this.cursorFilter(input.cursor),
          );
    const page = list.slice(0, input.limit);
    return {
      data: page.map((item) => this.connectionView(item, actor.userId)),
      pagination: {
        hasMore: list.length > input.limit,
        nextCursor:
          list.length > input.limit && page[page.length - 1]
            ? encodeCursor({
                createdAt: page[page.length - 1]!.createdAt.toISOString(),
                id: page[page.length - 1]!.id,
              })
            : null,
      },
    };
  }
  async blockUser(actor: Actor, targetId: string, correlationId: string) {
    assertActiveActor(actor.accountState);
    if (actor.userId === targetId)
      throw new AppError('INVALID_BLOCK', 'You cannot block yourself.', 422);
    if (!(await this.users.findById(targetId)))
      throw new AppError('RESOURCE_NOT_FOUND', 'The user was not found.', 404);
    await withMongoTransaction(async (session) => {
      const block = await this.blocks.add(actor.userId, targetId, session);
      await this.record(
        'USER_BLOCKED',
        'USER',
        targetId,
        actor.userId,
        correlationId,
        { blockedUserId: targetId },
        session,
      );
      const connection = await this.connections.removeForUser(actor.userId, targetId, session);
      if (connection)
        await this.record(
          'CONNECTION_REMOVED',
          'CONNECTION',
          connection.id,
          actor.userId,
          correlationId,
          { connectionId: connection.id, reason: 'BLOCKED' },
          session,
        );
      return block;
    });
  }
  async unblockUser(actor: Actor, targetId: string, correlationId: string) {
    await withMongoTransaction(async (session) => {
      await this.blocks.remove(actor.userId, targetId, session);
      await this.record(
        'USER_UNBLOCKED',
        'USER',
        targetId,
        actor.userId,
        correlationId,
        { unblockedUserId: targetId },
        session,
      );
    });
  }
}
