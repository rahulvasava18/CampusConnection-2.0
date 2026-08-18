import { Types, type ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentDocument, PostDocument } from '../../src/modules/social/infrastructure/social.models';
import type {
  BlockRepository,
  CommentRepository,
  ConnectionRepository,
  PostRepository,
  ReactionRepository,
} from '../../src/modules/social/infrastructure/social.repositories';
import type { UserRepository } from '../../src/modules/identity/infrastructure/identity.repositories';
import type { DomainEventRecorder } from '../../src/infrastructure/events/domain-event';
import { SocialService } from '../../src/modules/social/application/social.service';
import {
  commentCreateSchema,
  commentIdParams,
  commentUpdateSchema,
} from '../../src/modules/social/interfaces/social.schemas';

vi.mock('../../src/modules/social/application/social.transaction', () => ({
  withMongoTransaction: async <T>(work: (session: ClientSession) => Promise<T>) =>
    work({} as ClientSession),
}));

const actorId = new Types.ObjectId();
const otherUserId = new Types.ObjectId();
const postId = new Types.ObjectId();
const parentId = new Types.ObjectId();
const commentId = new Types.ObjectId();
const correlationId = 'comment-test-correlation';

function user(id: Types.ObjectId) {
  return {
    id: id.toString(),
    username: id.equals(actorId) ? 'rahul' : 'other-user',
    displayName: id.equals(actorId) ? 'Rahul' : 'Other User',
  };
}

function post(overrides: Partial<PostDocument> = {}) {
  return {
    _id: postId,
    authorId: actorId,
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as unknown as PostDocument;
}

function comment(
  id: Types.ObjectId = commentId,
  authorId: Types.ObjectId = actorId,
  overrides: Partial<CommentDocument> = {},
) {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  return {
    _id: id,
    id: id.toString(),
    postId,
    authorId,
    content: 'A comment',
    status: 'ACTIVE',
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  } as unknown as CommentDocument;
}

function fixture(options: { post?: PostDocument | null; comment?: CommentDocument | null } = {}) {
  const currentPost = options.post === undefined ? post() : options.post;
  const currentComment = options.comment === undefined ? comment() : options.comment;
  const posts = {
    findById: vi.fn(async () => currentPost),
  } as unknown as PostRepository;
  const comments = {
    findById: vi.fn(async (id: string) =>
      currentComment && id === currentComment.id ? currentComment : null,
    ),
    create: vi.fn(async (input: Partial<CommentDocument>) =>
      comment(commentId, actorId, {
        content: input.content ?? 'Created comment',
        ...(input.parentCommentId ? { parentCommentId: input.parentCommentId } : {}),
      }),
    ),
    update: vi.fn(async (id: string, changes: Partial<CommentDocument>) =>
      currentComment && id === currentComment.id
        ? comment(currentComment._id, currentComment.authorId, {
            ...currentComment,
            ...changes,
          })
        : null,
    ),
    softDelete: vi.fn(async () => currentComment),
  } as unknown as CommentRepository;
  const users = {
    findById: vi.fn(async (id: string) => user(new Types.ObjectId(id))),
  } as unknown as UserRepository;
  const reactions = {
    count: vi.fn(async () => 0),
    has: vi.fn(async () => false),
  } as unknown as ReactionRepository;
  const connections = {
    areConnected: vi.fn(async () => false),
  } as unknown as ConnectionRepository;
  const blocks = {
    eitherBlocked: vi.fn(async () => false),
  } as unknown as BlockRepository;
  const events = { record: vi.fn() } as unknown as DomainEventRecorder;
  return { posts, comments, users, reactions, connections, blocks, events };
}

function createService(options: Parameters<typeof fixture>[0] = {}) {
  const dependencies = fixture(options);
  return { service: new SocialService(dependencies), dependencies };
}

describe('social comment interactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates comment content, IDs, and optional reply parents', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(commentCreateSchema.safeParse({ content: 'A comment', parentCommentId: id }).success).toBe(
      true,
    );
    expect(commentUpdateSchema.safeParse({ content: 'Edited comment' }).success).toBe(true);
    expect(commentCreateSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(commentUpdateSchema.safeParse({ content: '' }).success).toBe(false);
    expect(commentIdParams.safeParse({ commentId: id }).success).toBe(true);
    expect(commentIdParams.safeParse({ commentId: 'not-an-object-id' }).success).toBe(false);
  });

  it('creates a reply with the selected parent comment', async () => {
    const { service, dependencies } = createService({ comment: comment(parentId) });

    const created = await service.createComment(
      { userId: actorId.toString(), accountState: 'ACTIVE' },
      postId.toString(),
      { content: 'A reply', parentCommentId: parentId.toString() },
      correlationId,
    );

    expect(dependencies.comments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: expect.any(Types.ObjectId),
        authorId: expect.any(Types.ObjectId),
        content: 'A reply',
        parentCommentId: expect.objectContaining({
          toString: expect.any(Function),
        }),
      }),
      expect.anything(),
    );
    expect(created.parentCommentId).toBe(parentId.toString());
  });

  it('rejects replies whose parent comment does not exist', async () => {
    const { service } = createService();

    await expect(
      service.createComment(
        { userId: actorId.toString(), accountState: 'ACTIVE' },
        postId.toString(),
        { content: 'A reply', parentCommentId: parentId.toString() },
        correlationId,
      ),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('allows an owner to edit a non-empty comment', async () => {
    const { service, dependencies } = createService();

    const updated = await service.updateComment(
      { userId: actorId.toString(), accountState: 'ACTIVE' },
      commentId.toString(),
      'Edited comment',
    );

    expect(dependencies.comments.update).toHaveBeenCalledWith(commentId.toString(), {
      content: 'Edited comment',
    });
    expect(updated.content).toBe('Edited comment');
  });

  it('rejects edits by a different user', async () => {
    const { service, dependencies } = createService();

    await expect(
      service.updateComment(
        { userId: otherUserId.toString(), accountState: 'ACTIVE' },
        commentId.toString(),
        'Not allowed',
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(dependencies.comments.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an owner comment without deleting its replies', async () => {
    const { service, dependencies } = createService();

    await service.deleteComment(
      { userId: actorId.toString(), accountState: 'ACTIVE' },
      commentId.toString(),
      correlationId,
    );

    expect(dependencies.comments.softDelete).toHaveBeenCalledWith(
      commentId.toString(),
      expect.any(Types.ObjectId),
      expect.anything(),
    );
  });

  it('rejects deletion by a different user', async () => {
    const { service, dependencies } = createService();

    await expect(
      service.deleteComment(
        { userId: otherUserId.toString(), accountState: 'ACTIVE' },
        commentId.toString(),
        correlationId,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    expect(dependencies.comments.softDelete).not.toHaveBeenCalled();
  });
});
