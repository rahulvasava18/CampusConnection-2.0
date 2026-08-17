import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export type SessionStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED';

export interface SessionDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  status: SessionStatus;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  rotatedAt?: Date;
  revokedAt?: Date;
  replacedBySessionId?: Types.ObjectId;
  userAgent?: string;
  ipAddress?: string;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ROTATED', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    rotatedAt: { type: Date },
    revokedAt: { type: Date },
    replacedBySessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    userAgent: { type: String, maxlength: 500 },
    ipAddress: { type: String, maxlength: 100 },
  },
  { collection: 'sessions', timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, status: 1, expiresAt: 1 });
sessionSchema.index({ familyId: 1, status: 1 });

export const SessionModel: Model<SessionDocument> = model<SessionDocument>(
  'Session',
  sessionSchema,
);
