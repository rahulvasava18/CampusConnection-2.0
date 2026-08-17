import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface SecurityAuditDocument extends Document {
  actorId?: Types.ObjectId;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  correlationId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const securityAuditSchema = new Schema<SecurityAuditDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String },
    targetId: { type: String },
    requestId: { type: String, index: true },
    correlationId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { collection: 'security_audit_logs', timestamps: { createdAt: true, updatedAt: false } },
);

securityAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

export const SecurityAuditModel: Model<SecurityAuditDocument> = model<SecurityAuditDocument>(
  'SecurityAudit',
  securityAuditSchema,
);
