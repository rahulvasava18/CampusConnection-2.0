import type { ClientSession, FilterQuery, Types } from 'mongoose';
import {
  BlockModel,
  CommentModel,
  ConnectionModel,
  PostModel,
  ReactionModel,
  type BlockDocument,
  type CommentDocument,
  type ConnectionDocument,
  type PostDocument,
  type ReactionDocument,
} from './social.models';
import type { ConnectionState, ReactionTargetType, ReactionType } from '@campusconnection/shared';

export class PostRepository {
  findById(id: string, session?: ClientSession) {
    return PostModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<PostDocument>, session?: ClientSession) {
    const [doc] = await PostModel.create([input], { session });
    if (!doc) throw new Error('Post creation returned no document');
    return doc;
  }
  async update(id: string, changes: Partial<PostDocument>, session?: ClientSession) {
    return (await PostModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as PostDocument | null;
  }
  async softDelete(id: string, actorId: Types.ObjectId, session?: ClientSession) {
    return (await PostModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: { status: 'DELETED', deletedAt: new Date(), deletedBy: actorId } },
      { new: true, session: session ?? null },
    ).exec()) as unknown as PostDocument | null;
  }
  list(filter: FilterQuery<PostDocument>, limit: number, session?: ClientSession) {
    return PostModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class CommentRepository {
  findById(id: string, session?: ClientSession) {
    return CommentModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<CommentDocument>, session?: ClientSession) {
    const [doc] = await CommentModel.create([input], { session });
    if (!doc) throw new Error('Comment creation returned no document');
    return doc;
  }
  async update(id: string, changes: Partial<CommentDocument>, session?: ClientSession) {
    return (await CommentModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec()) as unknown as CommentDocument | null;
  }
  async softDelete(id: string, actorId: Types.ObjectId, session?: ClientSession) {
    return (await CommentModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: { status: 'DELETED', deletedAt: new Date(), deletedBy: actorId } },
      { new: true, session: session ?? null },
    ).exec()) as unknown as CommentDocument | null;
  }
  list(filter: FilterQuery<CommentDocument>, limit: number, session?: ClientSession) {
    return CommentModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class ReactionRepository {
  find(
    userId: Types.ObjectId,
    targetType: ReactionTargetType,
    targetId: string,
    reactionType: ReactionType,
    session?: ClientSession,
  ) {
    return ReactionModel.findOne({ userId, targetType, targetId, reactionType })
      .session(session ?? null)
      .exec();
  }
  async add(input: Partial<ReactionDocument>, session?: ClientSession) {
    const [doc] = await ReactionModel.create([input], { session });
    if (!doc) throw new Error('Reaction creation returned no document');
    return doc;
  }
  async remove(
    userId: Types.ObjectId,
    targetType: ReactionTargetType,
    targetId: string,
    reactionType: ReactionType,
    session?: ClientSession,
  ) {
    return ReactionModel.findOneAndDelete(
      { userId, targetType, targetId, reactionType },
      { session: session ?? null },
    ).exec();
  }
  count(targetType: ReactionTargetType, targetId: Types.ObjectId, session?: ClientSession) {
    return ReactionModel.countDocuments({ targetType, targetId })
      .session(session ?? null)
      .exec();
  }
  has(
    userId: Types.ObjectId,
    targetType: ReactionTargetType,
    targetId: Types.ObjectId,
    session?: ClientSession,
  ) {
    return ReactionModel.exists({ userId, targetType, targetId })
      .session(session ?? null)
      .exec();
  }
}

export class ConnectionRepository {
  private pair(a: string, b: string) {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
  }
  findPair(a: string, b: string, session?: ClientSession) {
    return ConnectionModel.findOne(this.pair(a, b))
      .session(session ?? null)
      .exec();
  }
  async savePair(
    a: string,
    b: string,
    changes: Partial<ConnectionDocument>,
    session?: ClientSession,
  ) {
    return (await ConnectionModel.findOneAndUpdate(
      this.pair(a, b),
      { $set: changes },
      { new: true, upsert: true, session: session ?? null, setDefaultsOnInsert: true },
    ).exec()) as unknown as ConnectionDocument | null;
  }
  async removeForUser(a: string, b: string, session?: ClientSession) {
    return (await ConnectionModel.findOneAndUpdate(
      { ...this.pair(a, b), state: { $in: ['PENDING', 'ACCEPTED'] } },
      { $set: { state: 'REMOVED', removedAt: new Date(), respondedAt: new Date() } },
      { new: true, session: session ?? null },
    ).exec()) as unknown as ConnectionDocument | null;
  }
  areConnected(a: string, b: string, session?: ClientSession) {
    return ConnectionModel.exists({ ...this.pair(a, b), state: 'ACCEPTED' })
      .session(session ?? null)
      .exec();
  }
  listForUser(
    userId: string,
    state: ConnectionState | ConnectionState[],
    limit: number,
    filter: Record<string, unknown> = {},
    session?: ClientSession,
  ) {
    return ConnectionModel.find({
      $or: [{ userAId: userId }, { userBId: userId }],
      state: Array.isArray(state) ? { $in: state } : state,
      ...filter,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  incoming(
    userId: string,
    limit: number,
    filter: Record<string, unknown> = {},
    session?: ClientSession,
  ) {
    return ConnectionModel.find({
      requestedBy: { $ne: userId },
      $or: [{ userAId: userId }, { userBId: userId }],
      state: 'PENDING',
      ...filter,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  outgoing(
    userId: string,
    limit: number,
    filter: Record<string, unknown> = {},
    session?: ClientSession,
  ) {
    return ConnectionModel.find({ requestedBy: userId, state: 'PENDING', ...filter })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class BlockRepository {
  find(blockerId: string, blockedUserId: string, session?: ClientSession) {
    return BlockModel.findOne({ blockerId, blockedUserId })
      .session(session ?? null)
      .exec();
  }
  async add(blockerId: string, blockedUserId: string, session?: ClientSession) {
    return (await BlockModel.findOneAndUpdate(
      { blockerId, blockedUserId },
      { $setOnInsert: { blockerId, blockedUserId } },
      { upsert: true, new: true, session: session ?? null, setDefaultsOnInsert: true },
    ).exec()) as unknown as BlockDocument;
  }
  async remove(blockerId: string, blockedUserId: string, session?: ClientSession) {
    return BlockModel.deleteOne(
      { blockerId, blockedUserId },
      { ...(session ? { session } : {}) },
    ).exec();
  }
  async eitherBlocked(a: string, b: string, session?: ClientSession) {
    return Boolean(
      await BlockModel.exists({
        $or: [
          { blockerId: a, blockedUserId: b },
          { blockerId: b, blockedUserId: a },
        ],
      }).session(session ?? null),
    );
  }
  async blockedUserIds(userId: string, session?: ClientSession): Promise<string[]> {
    const items = await BlockModel.find({ $or: [{ blockerId: userId }, { blockedUserId: userId }] })
      .select('blockerId blockedUserId')
      .session(session ?? null)
      .lean()
      .exec();
    return items.map((item) =>
      item.blockerId.toString() === userId
        ? item.blockedUserId.toString()
        : item.blockerId.toString(),
    );
  }
}
