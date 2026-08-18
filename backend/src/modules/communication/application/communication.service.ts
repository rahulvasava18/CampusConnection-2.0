import { Types, type ClientSession } from 'mongoose';
import type {
  ApiCollection,
  ConversationMemberView,
  ConversationView,
  EventType,
  MessageView,
  ReadState,
  ConversationType,
} from '@campusconnection/shared';
import { decodeCursor, encodeCursor } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { DomainEventRecorder } from '../../../infrastructure/events/domain-event';
import { UserModel } from '../../identity/infrastructure/user.model';
import { BlockRepository } from '../../social/infrastructure/social.repositories';
import {
  CommunityMemberModel,
  TeamMemberModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { withMongoTransaction } from '../../collaboration/application/collaboration.transaction';
import { publishRealtimeControl } from '../realtime/control';
import {
  type ConversationDocument,
  type ConversationMemberDocument,
  type MessageDocument,
} from '../infrastructure/communication.models';
import {
  ConversationRepository,
  MessageRepository,
} from '../infrastructure/communication.repositories';

export interface CommunicationActor {
  userId: string;
  accountState: string;
  roles: string[];
}
export interface CreateConversationInput {
  type: ConversationType;
  targetUserId?: string;
  title?: string;
  memberIds?: string[];
  teamId?: string;
  communityId?: string;
}
export interface SendMessageInput {
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  messageType: 'TEXT' | 'SYSTEM';
  replyToMessageId?: string;
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}
function validId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}
function cursorFilter(cursor?: string): Record<string, unknown> {
  if (!cursor) return {};
  try {
    const position = decodeCursor(cursor);
    if (!validId(position.id) || Number.isNaN(new Date(position.createdAt).valueOf()))
      throw new Error();
    return {
      $or: [
        { createdAt: { $lt: new Date(position.createdAt) } },
        { createdAt: new Date(position.createdAt), _id: { $lt: objectId(position.id) } },
      ],
    };
  } catch {
    throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
  }
}
function comparePosition(a: Date, aId: string, b: Date, bId: string): number {
  return a.valueOf() === b.valueOf() ? aId.localeCompare(bId) : a.valueOf() - b.valueOf();
}

export class CommunicationService {
  private readonly conversations: ConversationRepository;
  private readonly messages: MessageRepository;
  private readonly blocks: BlockRepository;
  private readonly events: DomainEventRecorder;
  public constructor(
    dependencies: {
      conversations?: ConversationRepository;
      messages?: MessageRepository;
      blocks?: BlockRepository;
      events?: DomainEventRecorder;
    } = {},
  ) {
    this.conversations = dependencies.conversations ?? new ConversationRepository();
    this.messages = dependencies.messages ?? new MessageRepository();
    this.blocks = dependencies.blocks ?? new BlockRepository();
    this.events = dependencies.events ?? new DomainEventRecorder();
  }

  async createConversation(
    actor: CommunicationActor,
    input: CreateConversationInput,
    correlationId: string,
  ): Promise<ConversationView> {
    this.active(actor);
    if (input.type === 'DIRECT') {
      if (
        !input.targetUserId ||
        !validId(input.targetUserId) ||
        input.targetUserId === actor.userId
      )
        throw new AppError('VALIDATION_ERROR', 'A different target user is required.', 422);
      if (await this.blocks.eitherBlocked(actor.userId, input.targetUserId))
        throw new AppError('FORBIDDEN', 'This conversation is not available.', 403);
      const pairKey = [actor.userId, input.targetUserId].sort().join(':');
      const existing = await this.conversations.findDirect(pairKey);
      if (existing) return this.conversationViewForActor(existing, actor.userId);
      await this.requireUsers([actor.userId, input.targetUserId]);
      try {
        const created = await withMongoTransaction(async (session) => {
          const conversation = await this.conversations.create(
            { type: 'DIRECT', pairKey, createdBy: objectId(actor.userId), status: 'ACTIVE' },
            session,
          );
          await this.conversations.createMember(
            {
              conversationId: conversation.id,
              userId: objectId(actor.userId),
              role: 'OWNER',
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
            session,
          );
          await this.conversations.createMember(
            {
              conversationId: conversation.id,
              userId: objectId(input.targetUserId!),
              role: 'MEMBER',
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
            session,
          );
          await this.record(
            'CONVERSATION_CREATED',
            'CONVERSATION',
            conversation.id,
            actor.userId,
            correlationId,
            { type: 'DIRECT' },
            session,
          );
          await this.record(
            'CONVERSATION_MEMBER_ADDED',
            'CONVERSATION',
            conversation.id,
            actor.userId,
            correlationId,
            { userId: input.targetUserId },
            session,
          );
          return conversation;
        });
        return this.conversationViewForActor(created, actor.userId);
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
        const concurrent = await this.conversations.findDirect(pairKey);
        if (!concurrent) throw error;
        return this.conversationViewForActor(concurrent, actor.userId);
      }
    }
    const memberIds = [...new Set([actor.userId, ...(input.memberIds ?? [])])];
    if (
      !['GROUP', 'TEAM', 'COMMUNITY'].includes(input.type) ||
      (input.type === 'GROUP' && (!input.title || input.title.trim().length < 1))
    )
      throw new AppError(
        'VALIDATION_ERROR',
        'A group title and supported conversation type are required.',
        422,
      );
    if (memberIds.some((id) => !validId(id)))
      throw new AppError('VALIDATION_ERROR', 'Conversation member identifiers are invalid.', 422);
    let contextMemberIds = memberIds;
    if (input.type === 'TEAM')
      contextMemberIds = await this.teamConversationMembers(actor, input.teamId);
    if (input.type === 'COMMUNITY')
      contextMemberIds = await this.communityConversationMembers(actor, input.communityId);
    await this.requireUsers(contextMemberIds);
    const created = await withMongoTransaction(async (session) => {
      const conversation = await this.conversations.create(
        {
          type: input.type,
          ...(input.title ? { title: input.title.trim() } : {}),
          createdBy: objectId(actor.userId),
          ...(input.teamId ? { teamId: objectId(input.teamId) } : {}),
          ...(input.communityId ? { communityId: objectId(input.communityId) } : {}),
          status: 'ACTIVE',
        },
        session,
      );
      for (const userId of contextMemberIds)
        await this.conversations.createMember(
          {
            conversationId: conversation.id,
            userId: objectId(userId),
            role: userId === actor.userId ? 'OWNER' : 'MEMBER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
          session,
        );
      await this.record(
        'CONVERSATION_CREATED',
        'CONVERSATION',
        conversation.id,
        actor.userId,
        correlationId,
        { type: input.type },
        session,
      );
      return conversation;
    });
    return this.conversationViewForActor(created, actor.userId);
  }

  async listConversations(
    actor: CommunicationActor,
    input: { limit: number; cursor?: string },
  ): Promise<ApiCollection<ConversationView>> {
    this.active(actor);
    const items = await this.conversations.listForUser(actor.userId, 500);
    let cursorDate: Date | undefined;
    let cursorId: string | undefined;
    if (input.cursor) {
      try {
        const cursor = decodeCursor(input.cursor);
        cursorDate = new Date(cursor.createdAt);
        cursorId = cursor.id;
        if (!validId(cursorId) || Number.isNaN(cursorDate.valueOf())) throw new Error();
      } catch {
        throw new AppError('INVALID_CURSOR', 'The pagination cursor is invalid.', 400);
      }
    }
    const visible = items.filter((item) => {
      if (!cursorDate || !cursorId) return true;
      const date = item.lastMessageAt ?? item.createdAt;
      return comparePosition(date, item.id, cursorDate, cursorId) < 0;
    });
    const page = visible.slice(0, input.limit + 1);
    const data = await Promise.all(
      page.slice(0, input.limit).map((item) => this.conversationViewForActor(item, actor.userId)),
    );
    const last = page[input.limit - 1];
    return {
      data,
      pagination: {
        hasMore: page.length > input.limit,
        nextCursor:
          page.length > input.limit && last
            ? encodeCursor({
                createdAt: (last.lastMessageAt ?? last.createdAt).toISOString(),
                id: last.id,
              })
            : null,
      },
    };
  }

  async getConversation(
    actor: CommunicationActor,
    conversationId: string,
  ): Promise<ConversationView> {
    const conversation = await this.requireConversation(actor, conversationId);
    return this.conversationViewForActor(conversation, actor.userId);
  }
  async updateConversation(
    actor: CommunicationActor,
    conversationId: string,
    title: string,
  ): Promise<ConversationView> {
    this.active(actor);
    await this.requireConversation(actor, conversationId);
    const member = await this.conversations.findMember(conversationId, actor.userId);
    if (!member || !['OWNER', 'ADMIN'].includes(member.role))
      throw new AppError('FORBIDDEN', 'Conversation management permission is required.', 403);
    const updated = await this.conversations.update(conversationId, { title: title.trim() });
    if (!updated) throw new AppError('RESOURCE_NOT_FOUND', 'The conversation was not found.', 404);
    return this.conversationViewForActor(updated, actor.userId);
  }
  async listMembers(
    actor: CommunicationActor,
    conversationId: string,
  ): Promise<{ data: ConversationMemberView[]; pagination: { hasMore: false; nextCursor: null } }> {
    await this.requireConversation(actor, conversationId);
    const members = await this.conversations.listMembers(conversationId);
    return {
      data: members.map((item) => this.memberView(item)),
      pagination: { hasMore: false, nextCursor: null },
    };
  }
  async addMember(
    actor: CommunicationActor,
    conversationId: string,
    userId: string,
    correlationId: string,
  ): Promise<ConversationMemberView> {
    this.active(actor);
    const conversation = await this.requireConversation(actor, conversationId);
    const manager = await this.conversations.findMember(conversationId, actor.userId);
    if (!manager || !['OWNER', 'ADMIN'].includes(manager.role) || conversation.type === 'DIRECT')
      throw new AppError('FORBIDDEN', 'You cannot add members to this conversation.', 403);
    if (!validId(userId))
      throw new AppError('VALIDATION_ERROR', 'The user identifier is invalid.', 422);
    await this.requireUsers([userId]);
    if (await this.blocks.eitherBlocked(actor.userId, userId))
      throw new AppError('FORBIDDEN', 'This member cannot be added.', 403);
    const member = await withMongoTransaction(async (session) => {
      const result = await this.conversations.saveMember(
        conversationId,
        userId,
        { status: 'ACTIVE', role: 'MEMBER', joinedAt: new Date() },
        session,
      );
      await this.record(
        'CONVERSATION_MEMBER_ADDED',
        'CONVERSATION',
        conversationId,
        actor.userId,
        correlationId,
        { userId },
        session,
      );
      return result;
    });
    await publishRealtimeControl({ type: 'conversation-member-added', conversationId, userId });
    return this.memberView(member);
  }
  async removeMember(
    actor: CommunicationActor,
    conversationId: string,
    userId: string,
    correlationId: string,
  ): Promise<void> {
    this.active(actor);
    const conversation = await this.requireConversation(actor, conversationId);
    const manager = await this.conversations.findMember(conversationId, actor.userId);
    if (
      !manager ||
      !['OWNER', 'ADMIN'].includes(manager.role) ||
      conversation.type === 'DIRECT' ||
      userId === actor.userId
    )
      throw new AppError('FORBIDDEN', 'You cannot remove this member.', 403);
    const member = await this.conversations.findMember(conversationId, userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError(
        'MEMBERSHIP_NOT_FOUND',
        'Active conversation membership was not found.',
        404,
      );
    await withMongoTransaction(async (session) => {
      await this.conversations.updateMember(
        conversationId,
        userId,
        { status: 'REMOVED', leftAt: new Date() },
        session,
      );
      await this.record(
        'CONVERSATION_MEMBER_REMOVED',
        'CONVERSATION',
        conversationId,
        actor.userId,
        correlationId,
        { userId },
        session,
      );
    });
    await publishRealtimeControl({ type: 'conversation-member-removed', conversationId, userId });
  }
  async leaveConversation(
    actor: CommunicationActor,
    conversationId: string,
    correlationId: string,
  ): Promise<void> {
    this.active(actor);
    const conversation = await this.requireConversation(actor, conversationId);
    const member = await this.conversations.findMember(conversationId, actor.userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError(
        'MEMBERSHIP_NOT_FOUND',
        'Active conversation membership was not found.',
        404,
      );
    if (member.role === 'OWNER' && conversation.type !== 'DIRECT')
      throw new AppError(
        'OWNER_CANNOT_LEAVE',
        'Transfer conversation ownership before leaving.',
        422,
      );
    await withMongoTransaction(async (session) => {
      await this.conversations.updateMember(
        conversationId,
        actor.userId,
        { status: 'LEFT', leftAt: new Date() },
        session,
      );
      await this.record(
        'CONVERSATION_MEMBER_LEFT',
        'CONVERSATION',
        conversationId,
        actor.userId,
        correlationId,
        { userId: actor.userId },
        session,
      );
    });
    await publishRealtimeControl({
      type: 'conversation-member-left',
      conversationId,
      userId: actor.userId,
    });
  }

  async listMessages(
    actor: CommunicationActor,
    conversationId: string,
    input: { limit: number; cursor?: string },
  ): Promise<ApiCollection<MessageView>> {
    await this.requireConversation(actor, conversationId);
    const messages = await this.messages.list(
      { conversationId: objectId(conversationId), ...cursorFilter(input.cursor) },
      input.limit + 1,
    );
    const data = messages.slice(0, input.limit).map((item) => this.messageView(item));
    const last = data[data.length - 1];
    return {
      data,
      pagination: {
        hasMore: messages.length > input.limit,
        nextCursor:
          messages.length > input.limit && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null,
      },
    };
  }
  async sendMessage(
    input: SendMessageInput,
    correlationId: string,
  ): Promise<{ message: MessageView; duplicate: boolean }> {
    if (!validId(input.conversationId) || !validId(input.senderId))
      throw new AppError(
        'VALIDATION_ERROR',
        'The conversation or sender identifier is invalid.',
        422,
      );
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation || conversation.status !== 'ACTIVE')
      throw new AppError('CONVERSATION_NOT_AVAILABLE', 'The conversation is not available.', 404);
    const member = await this.conversations.findMember(input.conversationId, input.senderId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError(
        'CONVERSATION_ACCESS_DENIED',
        'You are not an active conversation member.',
        403,
      );
    const existing = await this.messages.findByClientMessage(
      input.conversationId,
      input.senderId,
      input.clientMessageId,
    );
    if (existing) {
      if (existing.content !== input.content || existing.messageType !== input.messageType)
        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          'The client message identifier was already used with different content.',
          409,
        );
      return { message: this.messageView(existing), duplicate: true };
    }
    try {
      const message = await withMongoTransaction(async (session) => {
        const created = await this.messages.create(
          {
            conversationId: objectId(input.conversationId),
            senderId: objectId(input.senderId),
            clientMessageId: input.clientMessageId,
            content: input.content,
            messageType: input.messageType,
            ...(input.replyToMessageId
              ? { replyToMessageId: objectId(input.replyToMessageId) }
              : {}),
            status: 'ACTIVE',
          },
          session,
        );
        await this.conversations.update(
          input.conversationId,
          { lastMessageAt: created.createdAt, lastMessageId: created._id },
          session,
        );
        await this.record(
          'MESSAGE_SENT',
          'MESSAGE',
          created.id,
          input.senderId,
          correlationId,
          { conversationId: input.conversationId, messageId: created.id },
          session,
        );
        return created;
      });
      return { message: this.messageView(message), duplicate: false };
    } catch (error) {
      const duplicateKey =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) throw error;
      const duplicate = await this.messages.findByClientMessage(
        input.conversationId,
        input.senderId,
        input.clientMessageId,
      );
      if (!duplicate) throw error;
      if (duplicate.content !== input.content || duplicate.messageType !== input.messageType)
        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          'The client message identifier was already used with different content.',
          409,
        );
      return { message: this.messageView(duplicate), duplicate: true };
    }
  }
  async markRead(
    actor: CommunicationActor,
    conversationId: string,
    messageId: string,
    correlationId: string,
  ): Promise<ReadState> {
    await this.requireConversation(actor, conversationId);
    const member = await this.conversations.findMember(conversationId, actor.userId);
    const target = await this.messages.findById(messageId);
    if (!member || !target || target.conversationId.toString() !== conversationId)
      throw new AppError('RESOURCE_NOT_FOUND', 'The message was not found.', 404);
    if (member.lastReadMessageId) {
      const current = await this.messages.findById(member.lastReadMessageId.toString());
      if (
        current &&
        comparePosition(target.createdAt, target.id, current.createdAt, current.id) <= 0
      )
        return {
          conversationId,
          lastReadMessageId: current.id,
          ...(member.lastReadAt ? { lastReadAt: member.lastReadAt.toISOString() } : {}),
        };
    }
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.conversations.updateMember(
        conversationId,
        actor.userId,
        { lastReadMessageId: target._id, lastReadAt: new Date() },
        session,
      );
      if (!result)
        throw new AppError(
          'MEMBERSHIP_NOT_FOUND',
          'Active conversation membership was not found.',
          404,
        );
      await this.record(
        'MESSAGE_READ',
        'CONVERSATION_MEMBER',
        result.id,
        actor.userId,
        correlationId,
        { conversationId, messageId },
        session,
      );
      return result;
    });
    return {
      conversationId,
      ...(updated.lastReadMessageId
        ? { lastReadMessageId: updated.lastReadMessageId.toString() }
        : {}),
      ...(updated.lastReadAt ? { lastReadAt: updated.lastReadAt.toISOString() } : {}),
    };
  }
  async editMessage(
    actor: CommunicationActor,
    messageId: string,
    content: string,
    correlationId: string,
  ): Promise<MessageView> {
    const message = await this.messages.findById(messageId);
    if (!message || message.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The message was not found.', 404);
    await this.requireConversation(actor, message.conversationId.toString());
    if (message.senderId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the sender can edit this message.', 403);
    const updated = await withMongoTransaction(async (session) => {
      const result = await this.messages.update(
        messageId,
        { content, editedAt: new Date() },
        session,
      );
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The message was not found.', 404);
      await this.record(
        'MESSAGE_EDITED',
        'MESSAGE',
        messageId,
        actor.userId,
        correlationId,
        { conversationId: message.conversationId.toString(), messageId },
        session,
      );
      return result;
    });
    const view = this.messageView(updated);
    await publishRealtimeControl({
      type: 'message-updated',
      conversationId: view.conversationId,
      message: view,
    });
    return view;
  }
  async deleteMessage(
    actor: CommunicationActor,
    messageId: string,
    correlationId: string,
  ): Promise<MessageView> {
    const message = await this.messages.findById(messageId);
    if (!message || message.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The message was not found.', 404);
    await this.requireConversation(actor, message.conversationId.toString());
    if (message.senderId.toString() !== actor.userId)
      throw new AppError('FORBIDDEN', 'Only the sender can delete this message.', 403);
    const deleted = await withMongoTransaction(async (session) => {
      const result = await this.messages.update(
        messageId,
        { status: 'DELETED', deletedAt: new Date(), content: '' },
        session,
      );
      if (!result) throw new AppError('RESOURCE_NOT_FOUND', 'The message was not found.', 404);
      await this.record(
        'MESSAGE_DELETED',
        'MESSAGE',
        messageId,
        actor.userId,
        correlationId,
        { conversationId: message.conversationId.toString(), messageId },
        session,
      );
      return result;
    });
    const view = this.messageView(deleted);
    await publishRealtimeControl({
      type: 'message-deleted',
      conversationId: view.conversationId,
      message: view,
    });
    return view;
  }

  private active(actor: CommunicationActor) {
    if (actor.accountState !== 'ACTIVE' && actor.accountState !== 'RESTRICTED')
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot use communication.', 403);
  }
  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }
  private async conversationViewForActor(
    item: ConversationDocument,
    actorUserId: string,
  ): Promise<ConversationView> {
    const view = this.conversationView(item);
    const member = await this.conversations.findMember(item.id, actorUserId);
    if (!member) return view;
    const [unreadCount, lastMessage, peer] = await Promise.all([
      this.messages.countUnread(item.id, actorUserId, member.lastReadAt),
      item.lastMessageId ? this.messages.findById(item.lastMessageId.toString()) : undefined,
      item.type === 'DIRECT'
        ? this.directPeerView(item.id, actorUserId)
        : Promise.resolve(undefined),
    ]);
    return {
      ...view,
      unreadCount,
      ...(lastMessage
        ? {
            lastMessagePreview:
              lastMessage.status === 'DELETED'
                ? 'Message deleted'
                : lastMessage.content.slice(0, 120),
          }
        : {}),
      ...(peer ? { peer } : {}),
    };
  }
  private async directPeerView(
    conversationId: string,
    actorUserId: string,
  ): Promise<ConversationView['peer']> {
    const members = await this.conversations.listMembers(conversationId);
    const peerId = members.find((member) => member.userId.toString() !== actorUserId)?.userId;
    if (!peerId) return undefined;
    const peer = await UserModel.findById(peerId)
      .select('username displayName avatarUrl accountState')
      .lean()
      .exec();
    if (!peer || !['ACTIVE', 'RESTRICTED'].includes(peer.accountState)) return undefined;
    return {
      userId: peerId.toString(),
      username: peer.username,
      displayName: peer.displayName,
      ...(peer.avatarUrl ? { avatarUrl: peer.avatarUrl } : {}),
    };
  }
  private async requireUsers(ids: string[]) {
    const count = await UserModel.countDocuments({
      _id: { $in: ids },
      accountState: { $in: ['ACTIVE', 'RESTRICTED'] },
    });
    if (count !== ids.length)
      throw new AppError('RESOURCE_NOT_FOUND', 'One or more users were not found.', 404);
  }
  private async requireConversation(
    actor: CommunicationActor,
    conversationId: string,
  ): Promise<ConversationDocument> {
    if (!validId(conversationId))
      throw new AppError('VALIDATION_ERROR', 'The conversation identifier is invalid.', 422);
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation || conversation.status !== 'ACTIVE')
      throw new AppError('RESOURCE_NOT_FOUND', 'The conversation was not found.', 404);
    const member = await this.conversations.findMember(conversationId, actor.userId);
    if (!member || member.status !== 'ACTIVE')
      throw new AppError(
        'CONVERSATION_ACCESS_DENIED',
        'You are not an active conversation member.',
        403,
      );
    return conversation;
  }
  private async teamConversationMembers(
    actor: CommunicationActor,
    teamId?: string,
  ): Promise<string[]> {
    if (!teamId || !validId(teamId))
      throw new AppError('VALIDATION_ERROR', 'A valid team identifier is required.', 422);
    const member = await TeamMemberModel.findOne({
      teamId,
      userId: actor.userId,
      status: 'ACTIVE',
    });
    if (!member) throw new AppError('FORBIDDEN', 'Active team membership is required.', 403);
    const members = await TeamMemberModel.find({ teamId, status: 'ACTIVE' })
      .select('userId')
      .lean()
      .exec();
    return members.map((item) => item.userId.toString());
  }
  private async communityConversationMembers(
    actor: CommunicationActor,
    communityId?: string,
  ): Promise<string[]> {
    if (!communityId || !validId(communityId))
      throw new AppError('VALIDATION_ERROR', 'A valid community identifier is required.', 422);
    const member = await CommunityMemberModel.findOne({
      communityId,
      userId: actor.userId,
      status: 'ACTIVE',
    });
    if (!member) throw new AppError('FORBIDDEN', 'Active community membership is required.', 403);
    const members = await CommunityMemberModel.find({ communityId, status: 'ACTIVE' })
      .select('userId')
      .lean()
      .exec();
    return members.map((item) => item.userId.toString());
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
        producer: 'communication',
        aggregateType,
        aggregateId,
        actorId,
        correlationId,
        payload,
      },
      session,
    );
  }
  private conversationView(item: ConversationDocument): ConversationView {
    return {
      id: item.id,
      type: item.type,
      ...(item.title ? { title: item.title } : {}),
      createdBy: item.createdBy.toString(),
      ...(item.teamId ? { teamId: item.teamId.toString() } : {}),
      ...(item.communityId ? { communityId: item.communityId.toString() } : {}),
      ...(item.lastMessageAt ? { lastMessageAt: item.lastMessageAt.toISOString() } : {}),
      ...(item.lastMessageId ? { lastMessageId: item.lastMessageId.toString() } : {}),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
  private memberView(item: ConversationMemberDocument): ConversationMemberView {
    return {
      id: item.id,
      conversationId: item.conversationId.toString(),
      userId: item.userId.toString(),
      role: item.role,
      status: item.status,
      joinedAt: item.joinedAt.toISOString(),
      ...(item.leftAt ? { leftAt: item.leftAt.toISOString() } : {}),
      ...(item.lastReadMessageId ? { lastReadMessageId: item.lastReadMessageId.toString() } : {}),
      ...(item.lastReadAt ? { lastReadAt: item.lastReadAt.toISOString() } : {}),
      notificationPreference: item.notificationPreference,
    };
  }
  private messageView(item: MessageDocument): MessageView {
    return {
      id: item.id,
      conversationId: item.conversationId.toString(),
      senderId: item.senderId.toString(),
      clientMessageId: item.clientMessageId,
      content: item.status === 'DELETED' ? '' : item.content,
      messageType: item.messageType,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      ...(item.editedAt ? { editedAt: item.editedAt.toISOString() } : {}),
      ...(item.deletedAt ? { deletedAt: item.deletedAt.toISOString() } : {}),
      ...(item.replyToMessageId ? { replyToMessageId: item.replyToMessageId.toString() } : {}),
    };
  }
}
