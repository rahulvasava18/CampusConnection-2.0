import type { ClientSession, FilterQuery } from 'mongoose';
import {
  ConversationMemberModel,
  ConversationModel,
  MessageModel,
  type ConversationDocument,
  type ConversationMemberDocument,
  type MessageDocument,
} from './communication.models';

const sessionOptions = (session?: ClientSession) => (session ? { session } : {});

export class ConversationRepository {
  findById(id: string, session?: ClientSession) {
    return ConversationModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findDirect(pairKey: string, session?: ClientSession) {
    return ConversationModel.findOne({ type: 'DIRECT', pairKey, status: { $ne: 'DISABLED' } })
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<ConversationDocument>, session?: ClientSession) {
    const [document] = await ConversationModel.create([input], sessionOptions(session));
    if (!document) throw new Error('Conversation creation returned no document');
    return document;
  }
  async update(id: string, changes: Partial<ConversationDocument>, session?: ClientSession) {
    return ConversationModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  async listForUser(userId: string, limit: number, session?: ClientSession) {
    const memberships = await ConversationMemberModel.find({ userId, status: 'ACTIVE' })
      .select('conversationId')
      .sort({ updatedAt: -1 })
      .limit(500)
      .session(session ?? null)
      .lean()
      .exec();
    const ids = memberships.map((item) => item.conversationId);
    if (!ids.length) return [] as ConversationDocument[];
    return ConversationModel.find({ _id: { $in: ids }, status: 'ACTIVE' })
      .sort({ lastMessageAt: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  findMember(conversationId: string, userId: string, session?: ClientSession) {
    return ConversationMemberModel.findOne({ conversationId, userId })
      .session(session ?? null)
      .exec();
  }
  async createMember(input: Partial<ConversationMemberDocument>, session?: ClientSession) {
    const [document] = await ConversationMemberModel.create([input], sessionOptions(session));
    if (!document) throw new Error('Conversation membership creation returned no document');
    return document;
  }
  async saveMember(
    conversationId: string,
    userId: string,
    changes: Partial<ConversationMemberDocument>,
    session?: ClientSession,
  ) {
    return ConversationMemberModel.findOneAndUpdate(
      { conversationId, userId },
      { $set: changes, $setOnInsert: { conversationId, userId } },
      { new: true, upsert: true, setDefaultsOnInsert: true, session: session ?? null },
    ).exec();
  }
  async updateMember(
    conversationId: string,
    userId: string,
    changes: Partial<ConversationMemberDocument>,
    session?: ClientSession,
  ) {
    return ConversationMemberModel.findOneAndUpdate(
      { conversationId, userId },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  listMembers(conversationId: string, limit = 100, session?: ClientSession) {
    return ConversationMemberModel.find({ conversationId, status: 'ACTIVE' })
      .sort({ joinedAt: 1, _id: 1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
}

export class MessageRepository {
  findById(id: string, session?: ClientSession) {
    return MessageModel.findById(id)
      .session(session ?? null)
      .exec();
  }
  findByClientMessage(
    conversationId: string,
    senderId: string,
    clientMessageId: string,
    session?: ClientSession,
  ) {
    return MessageModel.findOne({ conversationId, senderId, clientMessageId })
      .session(session ?? null)
      .exec();
  }
  async create(input: Partial<MessageDocument>, session?: ClientSession) {
    const [document] = await MessageModel.create([input], sessionOptions(session));
    if (!document) throw new Error('Message creation returned no document');
    return document;
  }
  async update(id: string, changes: Partial<MessageDocument>, session?: ClientSession) {
    return MessageModel.findOneAndUpdate(
      { _id: id, status: 'ACTIVE' },
      { $set: changes },
      { new: true, session: session ?? null },
    ).exec();
  }
  list(filter: FilterQuery<MessageDocument>, limit: number, session?: ClientSession) {
    return MessageModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .session(session ?? null)
      .exec();
  }
  countUnread(conversationId: string, userId: string, lastReadAt?: Date) {
    return MessageModel.countDocuments({
      conversationId,
      senderId: { $ne: userId },
      status: 'ACTIVE',
      ...(lastReadAt ? { createdAt: { $gt: lastReadAt } } : {}),
    }).exec();
  }
}
