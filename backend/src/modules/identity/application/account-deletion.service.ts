import { Types, type ClientSession } from 'mongoose';
import { getRedisClient } from '../../../infrastructure/redis/client';
import { CloudinaryMediaStorage, type MediaStorage } from '../../../infrastructure/media/media-storage';
import { MediaAssetModel } from '../../../infrastructure/media/media.models';
import { publishRealtimeControl } from '../../communication/realtime/control';
import {
  ConversationMemberModel,
  ConversationModel,
  MessageModel,
} from '../../communication/infrastructure/communication.models';
import {
  CommunityBanModel,
  CommunityInvitationModel,
  CommunityJoinRequestModel,
  CommunityMemberModel,
  CommunityModel,
  CommunityReportModel,
  DiscussionModel,
  EventModel,
  EventRegistrationModel,
  MilestoneModel,
  ProjectActivityModel,
  ProjectInvitationModel,
  ProjectJoinRequestModel,
  ProjectMemberModel,
  ProjectModel,
  ProjectResourceModel,
  ReplyModel,
  TaskModel,
  TeamInvitationModel,
  TeamJoinRequestModel,
  TeamMemberModel,
  TeamModel,
  TeamRequirementModel,
} from '../../collaboration/infrastructure/collaboration.models';
import { RecommendationSignalModel, RecommendationSnapshotModel } from '../../intelligence/infrastructure/recommendation.models';
import { NotificationModel } from '../../notifications/infrastructure/notification.model';
import {
  ConnectionModel,
  BlockModel,
  CommentModel,
  PostModel,
  ReactionModel,
} from '../../social/infrastructure/social.models';
import { EmailVerificationModel } from '../infrastructure/email-verification.model';
import { RoleAssignmentModel } from '../infrastructure/role-assignment.model';
import { SecurityAuditModel } from '../infrastructure/security-audit.model';
import { SessionModel } from '../infrastructure/session.model';
import { UserModel } from '../infrastructure/user.model';
import { PendingSignupModel } from '../infrastructure/pending-signup.model';
import type { RequestMeta, AuthContext } from '../interfaces/auth.types';
import { withMongoTransaction } from '../../collaboration/application/collaboration.transaction';
import { AppError } from '../../../shared/errors/app-error';
import { logger } from '../../../shared/logging/logger';

type DeletionResult = {
  mediaPublicIds: string[];
  deletedAggregateIds: string[];
};

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function ids(values: Array<{ _id: Types.ObjectId }>): Types.ObjectId[] {
  return values.map((value) => value._id);
}

function hasIds(value: Types.ObjectId[]): boolean {
  return value.length > 0;
}

export class AccountDeletionService {
  public constructor(private readonly mediaStorage: MediaStorage = new CloudinaryMediaStorage()) {}

  public async deleteAccount(actor: AuthContext, meta: RequestMeta): Promise<void> {
    const result = await withMongoTransaction((session) =>
      this.deleteInTransaction(actor.userId, meta, session),
    );

    await Promise.allSettled(
      result.mediaPublicIds.map(async (publicId) => {
        try {
          await this.mediaStorage.deleteImage(publicId);
          await MediaAssetModel.deleteOne({ publicId }).exec();
        } catch (error) {
          logger.warn({ err: error, mediaCleanupPending: true }, 'Account media cleanup failed');
        }
      }),
    );

    await this.clearPresence(actor.userId);
    await publishRealtimeControl({ type: 'user-account-deleted', userId: actor.userId });
  }

  private async deleteInTransaction(
    userId: string,
    meta: RequestMeta,
    session: ClientSession,
  ): Promise<DeletionResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('ACCOUNT_NOT_FOUND', 'The account was not found.', 404);
    }
    const id = objectId(userId);
    const user = await UserModel.findById(id).session(session).exec();
    if (!user) throw new AppError('ACCOUNT_NOT_FOUND', 'The account was not found.', 404);

    const ownedCommunities = ids(
      await CommunityModel.find({ ownerId: id }).select('_id').session(session).lean().exec(),
    );
    const ownedTeams = ids(
      await TeamModel.find({ ownerId: id }).select('_id').session(session).lean().exec(),
    );
    const ownedProjects = ids(
      await ProjectModel.find({ ownerId: id }).select('_id').session(session).lean().exec(),
    );

    await this.assertOwnershipCanBeRemoved(ownedCommunities, CommunityMemberModel, 'communityId', id, session);
    await this.assertOwnershipCanBeRemoved(ownedTeams, TeamMemberModel, 'teamId', id, session);
    await this.assertOwnershipCanBeRemoved(ownedProjects, ProjectMemberModel, 'projectId', id, session);

    const mediaPublicIds = new Set<string>();
    const deletedAggregateIds = new Set<string>();
    const addAggregateIds = (values: Types.ObjectId[]) => {
      values.forEach((value) => deletedAggregateIds.add(value.toString()));
    };

    const userAssets = await MediaAssetModel.find({ ownerId: userId })
      .select('publicId')
      .session(session)
      .lean()
      .exec();
    userAssets.forEach((asset) => mediaPublicIds.add(asset.publicId));

    const deletedPostIds = await this.deletePosts(
      [{ authorId: id }, ...(hasIds(ownedCommunities) ? [{ communityId: { $in: ownedCommunities } }] : [])],
      id,
      mediaPublicIds,
      session,
    );
    addAggregateIds(deletedPostIds);

    const authoredComments = await CommentModel.find({ authorId: id })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    const authoredCommentIds = ids(authoredComments);
    if (hasIds(authoredCommentIds)) {
      await ReactionModel.deleteMany({ targetId: { $in: authoredCommentIds } }).session(session).exec();
      await CommentModel.deleteMany({ _id: { $in: authoredCommentIds } }).session(session).exec();
      addAggregateIds(authoredCommentIds);
    }
    await ReactionModel.deleteMany({ userId: id }).session(session).exec();
    await ConnectionModel.deleteMany({ $or: [{ userAId: id }, { userBId: id }, { requestedBy: id }] })
      .session(session)
      .exec();
    await BlockModel.deleteMany({ $or: [{ blockerId: id }, { blockedUserId: id }] })
      .session(session)
      .exec();

    const authoredReplies = await ReplyModel.find({ authorId: id })
      .select('discussionId')
      .session(session)
      .lean()
      .exec();
    const affectedDiscussionIds = [...new Set(authoredReplies.map((reply) => reply.discussionId.toString()))].map(
      objectId,
    );
    await ReplyModel.deleteMany({ authorId: id }).session(session).exec();
    await DiscussionModel.deleteMany({ authorId: id }).session(session).exec();
    for (const discussionId of affectedDiscussionIds) {
      const replyCount = await ReplyModel.countDocuments({ discussionId, status: 'ACTIVE' })
        .session(session)
        .exec();
      await DiscussionModel.updateOne({ _id: discussionId }, { $set: { replyCount } })
        .session(session)
        .exec();
    }

    await ProjectResourceModel.deleteMany({ createdBy: id }).session(session).exec();
    await ProjectActivityModel.deleteMany({ actorId: id }).session(session).exec();
    await TaskModel.deleteMany({ creatorId: id }).session(session).exec();
    await TaskModel.updateMany(
      { $or: [{ assigneeId: id }, { archivedBy: id }] },
      { $unset: { assigneeId: 1, archivedBy: 1 } },
    )
      .session(session)
      .exec();
    await MilestoneModel.updateMany({ createdBy: id }, { $unset: { createdBy: 1 } })
      .session(session)
      .exec();

    await this.deleteOwnedCommunities(ownedCommunities, deletedAggregateIds, session);
    await this.deleteOwnedTeams(ownedTeams, deletedAggregateIds, session);
    await this.deleteOwnedProjects(ownedProjects, deletedAggregateIds, session);

    const ownedEvents = ids(
      await EventModel.find({ organizerId: id }).select('_id').session(session).lean().exec(),
    );
    if (hasIds(ownedEvents)) {
      await EventRegistrationModel.deleteMany({ eventId: { $in: ownedEvents } }).session(session).exec();
      await EventModel.deleteMany({ _id: { $in: ownedEvents } }).session(session).exec();
      addAggregateIds(ownedEvents);
    }
    await EventRegistrationModel.deleteMany({ userId: id }).session(session).exec();

    await this.deleteCommunicationData(id, session);
    await this.removeCollaborationMemberships(id, session);

    await NotificationModel.deleteMany({
      $or: [
        { recipientId: userId },
        { actorId: userId },
        ...(deletedAggregateIds.size ? [{ aggregateId: { $in: [...deletedAggregateIds] } }] : []),
      ],
    })
      .session(session)
      .exec();
    await RecommendationSnapshotModel.deleteMany({ userId: id }).session(session).exec();
    await RecommendationSignalModel.deleteMany({ userId: id }).session(session).exec();
    if (mediaPublicIds.size) {
      await MediaAssetModel.updateMany(
        { publicId: { $in: [...mediaPublicIds] } },
        { $set: { status: 'ORPHANED' } },
      )
        .session(session)
        .exec();
    }

    await SessionModel.deleteMany({ userId: id }).session(session).exec();
    await EmailVerificationModel.deleteMany({ userId: id }).session(session).exec();
    await RoleAssignmentModel.deleteMany({ userId: id }).session(session).exec();
    await PendingSignupModel.deleteMany({ emailNormalized: user.email.toLowerCase() })
      .session(session)
      .exec();

    await SecurityAuditModel.create(
      [
        {
          actorId: id,
          action: 'ACCOUNT_DELETED',
          targetType: 'User',
          targetId: userId,
          requestId: meta.requestId,
          correlationId: meta.correlationId,
          metadata: { deletedAggregateCount: deletedAggregateIds.size },
        },
      ],
      { session },
    );
    await UserModel.deleteOne({ _id: id }).session(session).exec();

    return {
      mediaPublicIds: [...mediaPublicIds],
      deletedAggregateIds: [...deletedAggregateIds],
    };
  }

  private async assertOwnershipCanBeRemoved(
    resourceIds: Types.ObjectId[],
    memberModel: typeof CommunityMemberModel | typeof TeamMemberModel | typeof ProjectMemberModel,
    resourceField: 'communityId' | 'teamId' | 'projectId',
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    for (const resourceId of resourceIds) {
      const otherActiveMembers = await memberModel
        .countDocuments({ [resourceField]: resourceId, userId: { $ne: userId }, status: 'ACTIVE' })
        .session(session)
        .exec();
      if (otherActiveMembers > 0) {
        throw new AppError(
          'ACCOUNT_OWNERSHIP_TRANSFER_REQUIRED',
          'Transfer ownership of shared spaces before deleting your account.',
          409,
        );
      }
    }
  }

  private async deletePosts(
    filters: Array<Record<string, unknown>>,
    userId: Types.ObjectId,
    mediaPublicIds: Set<string>,
    session: ClientSession,
  ): Promise<Types.ObjectId[]> {
    const posts = await PostModel.find({ $or: filters })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    const postIds = ids(posts);
    if (!hasIds(postIds)) return [];
    const comments = await CommentModel.find({ postId: { $in: postIds } })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    const commentIds = ids(comments);
    const assetIds = await MediaAssetModel.find({ postId: { $in: postIds.map((value) => value.toString()) } })
      .select('publicId')
      .session(session)
      .lean()
      .exec();
    assetIds.forEach((asset) => mediaPublicIds.add(asset.publicId));
    await ReactionModel.deleteMany({
      $or: [
        { userId },
        { targetId: { $in: [...postIds, ...commentIds] } },
      ],
    })
      .session(session)
      .exec();
    await CommentModel.deleteMany({ postId: { $in: postIds } }).session(session).exec();
    await PostModel.deleteMany({ _id: { $in: postIds } }).session(session).exec();
    return postIds;
  }

  private async deleteOwnedCommunities(
    communityIds: Types.ObjectId[],
    deletedAggregateIds: Set<string>,
    session: ClientSession,
  ): Promise<void> {
    if (!hasIds(communityIds)) return;
    await EventModel.updateMany(
      { communityId: { $in: communityIds } },
      { $unset: { communityId: 1 } },
    )
      .session(session)
      .exec();
    await ConversationModel.updateMany(
      { communityId: { $in: communityIds } },
      { $unset: { communityId: 1 } },
    )
      .session(session)
      .exec();
    const discussions = await DiscussionModel.find({ communityId: { $in: communityIds } })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    const discussionIds = ids(discussions);
    const posts = await PostModel.find({ communityId: { $in: communityIds } })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    const postIds = ids(posts);
    const comments = hasIds(postIds)
      ? await CommentModel.find({ postId: { $in: postIds } }).select('_id').session(session).lean().exec()
      : [];
    const commentIds = ids(comments);
    if (hasIds(postIds) || hasIds(commentIds)) {
      await ReactionModel.deleteMany({ targetId: { $in: [...postIds, ...commentIds] } }).session(session).exec();
      await CommentModel.deleteMany({ postId: { $in: postIds } }).session(session).exec();
      await PostModel.deleteMany({ _id: { $in: postIds } }).session(session).exec();
    }
    if (hasIds(discussionIds)) {
      await ReplyModel.deleteMany({ discussionId: { $in: discussionIds } }).session(session).exec();
      await DiscussionModel.deleteMany({ _id: { $in: discussionIds } }).session(session).exec();
    }
    await CommunityMemberModel.deleteMany({ communityId: { $in: communityIds } }).session(session).exec();
    await CommunityJoinRequestModel.deleteMany({ communityId: { $in: communityIds } }).session(session).exec();
    await CommunityInvitationModel.deleteMany({ communityId: { $in: communityIds } }).session(session).exec();
    await CommunityBanModel.deleteMany({ communityId: { $in: communityIds } }).session(session).exec();
    await CommunityReportModel.deleteMany({ communityId: { $in: communityIds } }).session(session).exec();
    await RoleAssignmentModel.deleteMany({
      scopeType: 'COMMUNITY',
      scopeId: { $in: communityIds.map((value) => value.toString()) },
    })
      .session(session)
      .exec();
    await CommunityModel.deleteMany({ _id: { $in: communityIds } }).session(session).exec();
    [...communityIds, ...discussionIds, ...postIds, ...commentIds].forEach((value) =>
      deletedAggregateIds.add(value.toString()),
    );
  }

  private async deleteOwnedTeams(
    teamIds: Types.ObjectId[],
    deletedAggregateIds: Set<string>,
    session: ClientSession,
  ): Promise<void> {
    if (!hasIds(teamIds)) return;
    await EventModel.updateMany({ teamId: { $in: teamIds } }, { $unset: { teamId: 1 } })
      .session(session)
      .exec();
    await ConversationModel.updateMany({ teamId: { $in: teamIds } }, { $unset: { teamId: 1 } })
      .session(session)
      .exec();
    await ProjectModel.updateMany(
      { $or: [{ teamId: { $in: teamIds } }, { ownerTeamId: { $in: teamIds } }] },
      { $unset: { teamId: 1, ownerTeamId: 1 } },
    )
      .session(session)
      .exec();
    await TeamRequirementModel.deleteMany({ teamId: { $in: teamIds } }).session(session).exec();
    await TeamMemberModel.deleteMany({ teamId: { $in: teamIds } }).session(session).exec();
    await TeamJoinRequestModel.deleteMany({ teamId: { $in: teamIds } }).session(session).exec();
    await TeamInvitationModel.deleteMany({ teamId: { $in: teamIds } }).session(session).exec();
    await RoleAssignmentModel.deleteMany({
      scopeType: 'TEAM',
      scopeId: { $in: teamIds.map((value) => value.toString()) },
    })
      .session(session)
      .exec();
    await TeamModel.deleteMany({ _id: { $in: teamIds } }).session(session).exec();
    teamIds.forEach((value) => deletedAggregateIds.add(value.toString()));
  }

  private async deleteOwnedProjects(
    projectIds: Types.ObjectId[],
    deletedAggregateIds: Set<string>,
    session: ClientSession,
  ): Promise<void> {
    if (!hasIds(projectIds)) return;
    await TeamModel.updateMany({ projectId: { $in: projectIds } }, { $unset: { projectId: 1 } })
      .session(session)
      .exec();
    await ProjectMemberModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await ProjectJoinRequestModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await ProjectInvitationModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await ProjectResourceModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await ProjectActivityModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await TaskModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await MilestoneModel.deleteMany({ projectId: { $in: projectIds } }).session(session).exec();
    await RoleAssignmentModel.deleteMany({
      scopeType: 'PROJECT',
      scopeId: { $in: projectIds.map((value) => value.toString()) },
    })
      .session(session)
      .exec();
    await ProjectModel.deleteMany({ _id: { $in: projectIds } }).session(session).exec();
    projectIds.forEach((value) => deletedAggregateIds.add(value.toString()));
  }

  private async deleteCommunicationData(userId: Types.ObjectId, session: ClientSession): Promise<void> {
    const messages = await MessageModel.find({ senderId: userId })
      .select('conversationId')
      .session(session)
      .lean()
      .exec();
    const affectedConversationIds = new Set(messages.map((message) => message.conversationId.toString()));
    await MessageModel.deleteMany({ senderId: userId }).session(session).exec();

    const ownedConversations = await ConversationModel.find({ createdBy: userId })
      .select('_id')
      .session(session)
      .lean()
      .exec();
    ownedConversations.forEach((conversation) => affectedConversationIds.add(conversation._id.toString()));
    await ConversationMemberModel.deleteMany({ userId }).session(session).exec();

    for (const conversation of ownedConversations) {
      const remainingMember = await ConversationMemberModel.findOne({
        conversationId: conversation._id,
        status: 'ACTIVE',
      })
        .sort({ joinedAt: 1 })
        .select('userId')
        .session(session)
        .lean()
        .exec();
      if (remainingMember) {
        await ConversationModel.updateOne(
          { _id: conversation._id },
          { $set: { createdBy: remainingMember.userId } },
        )
          .session(session)
          .exec();
      } else {
        await MessageModel.deleteMany({ conversationId: conversation._id }).session(session).exec();
        await ConversationMemberModel.deleteMany({ conversationId: conversation._id })
          .session(session)
          .exec();
        await ConversationModel.deleteOne({ _id: conversation._id }).session(session).exec();
      }
    }

    for (const conversationId of affectedConversationIds) {
      const id = objectId(conversationId);
      if (!(await ConversationModel.exists({ _id: id }).session(session))) continue;
      const latestMessage = await MessageModel.findOne({ conversationId: id, status: 'ACTIVE' })
        .sort({ createdAt: -1, _id: -1 })
        .select('_id createdAt')
        .session(session)
        .lean()
        .exec();
      if (latestMessage) {
        await ConversationModel.updateOne(
          { _id: id },
          { $set: { lastMessageId: latestMessage._id, lastMessageAt: latestMessage.createdAt } },
        )
          .session(session)
          .exec();
      } else {
        await ConversationModel.updateOne(
          { _id: id },
          { $unset: { lastMessageId: 1, lastMessageAt: 1 } },
        )
          .session(session)
          .exec();
      }
    }
  }

  private async removeCollaborationMemberships(userId: Types.ObjectId, session: ClientSession): Promise<void> {
    await CommunityMemberModel.deleteMany({ userId }).session(session).exec();
    await CommunityJoinRequestModel.deleteMany({ $or: [{ userId }, { reviewedBy: userId }] })
      .session(session)
      .exec();
    await CommunityInvitationModel.deleteMany({ $or: [{ inviterId: userId }, { inviteeId: userId }] })
      .session(session)
      .exec();
    await CommunityBanModel.deleteMany({ $or: [{ userId }, { bannedBy: userId }] }).session(session).exec();
    await CommunityReportModel.deleteMany({ $or: [{ reporterId: userId }, { reviewedBy: userId }] })
      .session(session)
      .exec();

    await TeamMemberModel.deleteMany({ userId }).session(session).exec();
    await TeamJoinRequestModel.deleteMany({ $or: [{ userId }, { reviewedBy: userId }] }).session(session).exec();
    await TeamInvitationModel.deleteMany({ $or: [{ inviterId: userId }, { inviteeId: userId }] })
      .session(session)
      .exec();

    await ProjectMemberModel.deleteMany({ userId }).session(session).exec();
    await ProjectJoinRequestModel.deleteMany({ $or: [{ userId }, { reviewedBy: userId }] })
      .session(session)
      .exec();
    await ProjectInvitationModel.deleteMany({ $or: [{ inviterId: userId }, { inviteeId: userId }] })
      .session(session)
      .exec();
  }

  private async clearPresence(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const patterns = [
        `presence:${userId}:*`,
        `presence:sockets:${userId}`,
        `presence:conversation:*:${userId}`,
        `recommendations:user:${userId}:*`,
      ];
      for (const pattern of patterns) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
          cursor = nextCursor;
          if (keys.length) await redis.del(...keys);
        } while (cursor !== '0');
      }
    } catch (error) {
      logger.warn({ err: error }, 'Account presence cleanup unavailable');
    }
  }
}
