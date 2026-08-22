import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export type AdminModerationAction =
  | 'WARNING'
  | 'SUSPENSION'
  | 'BAN'
  | 'RESTORE'
  | 'SOFT_DELETE'
  | 'CONTENT_HIDE'
  | 'CONTENT_DELETE'
  | 'CONTENT_RESTORE'
  | 'TEAM_DISABLE'
  | 'TEAM_DELETE'
  | 'COMMUNITY_DISABLE'
  | 'COMMUNITY_DELETE'
  | 'EVENT_CANCEL'
  | 'EVENT_DELETE'
  | 'REPORT_RESOLVE'
  | 'REPORT_DISMISS';

export interface ModerationHistoryDocument extends Document {
  userId: Types.ObjectId;
  adminId: Types.ObjectId;
  action: AdminModerationAction;
  reason: string;
  metadata: Record<string, unknown>;
  relatedContentId?: string;
  expiresAt?: Date;
  notifyUser: boolean;
  createdAt: Date;
}

const moderationHistorySchema = new Schema<ModerationHistoryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      enum: [
        'WARNING',
        'SUSPENSION',
        'BAN',
        'RESTORE',
        'SOFT_DELETE',
        'CONTENT_HIDE',
        'CONTENT_DELETE',
        'CONTENT_RESTORE',
        'TEAM_DISABLE',
        'TEAM_DELETE',
        'COMMUNITY_DISABLE',
        'COMMUNITY_DELETE',
        'EVENT_CANCEL',
        'EVENT_DELETE',
        'REPORT_RESOLVE',
        'REPORT_DISMISS',
      ],
      required: true,
      index: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    relatedContentId: { type: String, trim: true },
    expiresAt: Date,
    notifyUser: { type: Boolean, default: true },
  },
  { collection: 'user_moderation_history', timestamps: { createdAt: true, updatedAt: false } },
);

moderationHistorySchema.index({ userId: 1, createdAt: -1, _id: -1 });

export const ModerationHistoryModel: Model<ModerationHistoryDocument> =
  model<ModerationHistoryDocument>('ModerationHistory', moderationHistorySchema);
