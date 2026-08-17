import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import type {
  ConversationMemberRole,
  ConversationMemberStatus,
  ConversationStatus,
  ConversationType,
  MessageStatus,
  MessageType,
  NotificationPreference,
} from '@campusconnection/shared';

const objectId = Schema.Types.ObjectId;

export interface ConversationDocument extends Document {
  type: ConversationType;
  pairKey?: string;
  title?: string;
  createdBy: Types.ObjectId;
  teamId?: Types.ObjectId;
  communityId?: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessageId?: Types.ObjectId;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}
const conversationSchema = new Schema<ConversationDocument>(
  {
    type: {
      type: String,
      enum: ['DIRECT', 'GROUP', 'TEAM', 'COMMUNITY'],
      required: true,
      index: true,
    },
    pairKey: { type: String, unique: true, sparse: true, index: true },
    title: { type: String, trim: true, maxlength: 160 },
    createdBy: { type: objectId, required: true, index: true },
    teamId: { type: objectId, index: true },
    communityId: { type: objectId, index: true },
    lastMessageAt: { type: Date, index: true },
    lastMessageId: objectId,
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'DISABLED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { collection: 'conversations', timestamps: true },
);
conversationSchema.index({ status: 1, lastMessageAt: -1, createdAt: -1, _id: -1 });
export const ConversationModel: Model<ConversationDocument> = model<ConversationDocument>(
  'Conversation',
  conversationSchema,
);

export interface ConversationMemberDocument extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ConversationMemberRole;
  status: ConversationMemberStatus;
  joinedAt: Date;
  leftAt?: Date;
  lastReadMessageId?: Types.ObjectId;
  lastReadAt?: Date;
  notificationPreference: NotificationPreference;
  createdAt: Date;
  updatedAt: Date;
}
const conversationMemberSchema = new Schema<ConversationMemberDocument>(
  {
    conversationId: { type: objectId, required: true },
    userId: { type: objectId, required: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' },
    status: { type: String, enum: ['ACTIVE', 'LEFT', 'REMOVED'], default: 'ACTIVE', index: true },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: Date,
    lastReadMessageId: objectId,
    lastReadAt: Date,
    notificationPreference: { type: String, enum: ['ALL', 'MENTIONS', 'NONE'], default: 'ALL' },
  },
  { collection: 'conversation_members', timestamps: true },
);
conversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationMemberSchema.index({ userId: 1, status: 1 });
conversationMemberSchema.index({ conversationId: 1, status: 1, joinedAt: 1 });
export const ConversationMemberModel: Model<ConversationMemberDocument> =
  model<ConversationMemberDocument>('ConversationMember', conversationMemberSchema);

export interface MessageDocument extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  clientMessageId: string;
  content: string;
  messageType: MessageType;
  replyToMessageId?: Types.ObjectId;
  status: MessageStatus;
  createdAt: Date;
  editedAt?: Date;
  deletedAt?: Date;
}
const messageSchema = new Schema<MessageDocument>(
  {
    conversationId: { type: objectId, required: true, index: true },
    senderId: { type: objectId, required: true, index: true },
    clientMessageId: { type: String, required: true, trim: true, maxlength: 100 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    messageType: { type: String, enum: ['TEXT', 'SYSTEM'], default: 'TEXT' },
    replyToMessageId: objectId,
    status: { type: String, enum: ['ACTIVE', 'DELETED'], default: 'ACTIVE', index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    editedAt: Date,
    deletedAt: Date,
  },
  { collection: 'messages', timestamps: { createdAt: true, updatedAt: false } },
);
messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ senderId: 1, conversationId: 1, clientMessageId: 1 }, { unique: true });
export const MessageModel: Model<MessageDocument> = model<MessageDocument>(
  'Message',
  messageSchema,
);
