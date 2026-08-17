import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import {
  POST_TYPES,
  type ConnectionState,
  type PostStatus,
  type PostType,
  type ReactionTargetType,
  type ReactionType,
  type Visibility,
} from '@campusconnection/shared';

export interface PostDocument extends Document {
  authorId: Types.ObjectId;
  type: PostType;
  content: string;
  tags: string[];
  communityId?: Types.ObjectId;
  link?: string;
  visibility: Visibility;
  mediaAssetIds: string[];
  status: PostStatus;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<PostDocument>(
  {
    authorId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: {
      type: String,
      enum: POST_TYPES,
      required: true,
    },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
    tags: { type: [String], default: [], maxlength: 10 },
    communityId: { type: Schema.Types.ObjectId, index: true },
    link: { type: String, trim: true, maxlength: 500 },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'CAMPUS', 'CONNECTIONS', 'COMMUNITY'],
      required: true,
      default: 'PUBLIC',
    },
    mediaAssetIds: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', index: true },
    deletedAt: Date,
    deletedBy: Schema.Types.ObjectId,
  },
  { collection: 'posts', timestamps: true },
);
postSchema.index({ authorId: 1, createdAt: -1, _id: -1 });
postSchema.index({ status: 1, visibility: 1, createdAt: -1, _id: -1 });
postSchema.index({ type: 1, createdAt: -1, _id: -1 });
export const PostModel: Model<PostDocument> = model<PostDocument>('Post', postSchema);

export interface CommentDocument extends Document {
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  content: string;
  parentCommentId?: Types.ObjectId;
  status: PostStatus;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const commentSchema = new Schema<CommentDocument>(
  {
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, required: true, index: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    parentCommentId: { type: Schema.Types.ObjectId, default: undefined },
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', index: true },
    deletedAt: Date,
    deletedBy: Schema.Types.ObjectId,
  },
  { collection: 'comments', timestamps: true },
);
commentSchema.index({ postId: 1, createdAt: -1, _id: -1 });
commentSchema.index({ parentCommentId: 1, createdAt: -1, _id: -1 });
export const CommentModel: Model<CommentDocument> = model<CommentDocument>(
  'Comment',
  commentSchema,
);

export interface ReactionDocument extends Document {
  userId: Types.ObjectId;
  targetType: ReactionTargetType;
  targetId: Types.ObjectId;
  reactionType: ReactionType;
  createdAt: Date;
}
const reactionSchema = new Schema<ReactionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ['POST', 'COMMENT'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reactionType: { type: String, enum: ['LIKE'], required: true },
  },
  { collection: 'reactions', timestamps: { createdAt: true, updatedAt: false } },
);
reactionSchema.index({ userId: 1, targetType: 1, targetId: 1, reactionType: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1, reactionType: 1 });
export const ReactionModel: Model<ReactionDocument> = model<ReactionDocument>(
  'Reaction',
  reactionSchema,
);

export interface ConnectionDocument extends Document {
  userAId: Types.ObjectId;
  userBId: Types.ObjectId;
  requestedBy: Types.ObjectId;
  state: ConnectionState;
  respondedAt?: Date;
  removedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const connectionSchema = new Schema<ConnectionDocument>(
  {
    userAId: { type: Schema.Types.ObjectId, required: true },
    userBId: { type: Schema.Types.ObjectId, required: true },
    requestedBy: { type: Schema.Types.ObjectId, required: true },
    state: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'REMOVED'], required: true },
    respondedAt: Date,
    removedAt: Date,
  },
  { collection: 'connections', timestamps: true },
);
connectionSchema.index({ userAId: 1, userBId: 1 }, { unique: true });
connectionSchema.index({ userAId: 1, state: 1 });
connectionSchema.index({ userBId: 1, state: 1 });
export const ConnectionModel: Model<ConnectionDocument> = model<ConnectionDocument>(
  'Connection',
  connectionSchema,
);

export interface BlockDocument extends Document {
  blockerId: Types.ObjectId;
  blockedUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
const blockSchema = new Schema<BlockDocument>(
  {
    blockerId: { type: Schema.Types.ObjectId, required: true },
    blockedUserId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: 'blocks', timestamps: true },
);
blockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });
blockSchema.index({ blockedUserId: 1 });
export const BlockModel: Model<BlockDocument> = model<BlockDocument>('Block', blockSchema);
