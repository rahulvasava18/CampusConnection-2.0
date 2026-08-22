import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export type AdminReportTargetType = 'USER' | 'POST' | 'COMMENT' | 'TEAM' | 'COMMUNITY' | 'EVENT';
export type AdminReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'ABUSE'
  | 'MISLEADING_INFORMATION'
  | 'IMPERSONATION'
  | 'SCAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';
export type AdminReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type AdminReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AdminReportDocument extends Document {
  reporterId: Types.ObjectId;
  targetType: AdminReportTargetType;
  targetId: Types.ObjectId;
  reason: AdminReportReason;
  description?: string;
  priority: AdminReportPriority;
  status: AdminReportStatus;
  assignedTo?: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  resolution?: string;
  resolutionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<AdminReportDocument>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: {
      type: String,
      enum: ['USER', 'POST', 'COMMENT', 'TEAM', 'COMMUNITY', 'EVENT'],
      required: true,
      index: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: {
      type: String,
      enum: [
        'SPAM',
        'HARASSMENT',
        'ABUSE',
        'MISLEADING_INFORMATION',
        'IMPERSONATION',
        'SCAM',
        'INAPPROPRIATE_CONTENT',
        'OTHER',
      ],
      required: true,
    },
    description: { type: String, trim: true, maxlength: 2000 },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW', index: true },
    status: { type: String, enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'], default: 'PENDING', index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    resolution: { type: String, trim: true, maxlength: 2000 },
    resolutionReason: { type: String, trim: true, maxlength: 1000 },
  },
  { collection: 'admin_reports', timestamps: true },
);

reportSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 });
reportSchema.index({ status: 1, priority: -1, createdAt: -1, _id: -1 });
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 });

export const AdminReportModel: Model<AdminReportDocument> = model<AdminReportDocument>(
  'AdminReport',
  reportSchema,
);
