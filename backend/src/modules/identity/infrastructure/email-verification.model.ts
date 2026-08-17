import { Schema, model, type Document, type Model, type Types } from 'mongoose';

export interface EmailVerificationDocument extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailVerificationSchema = new Schema<EmailVerificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'email_verifications', timestamps: true },
);

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationModel: Model<EmailVerificationDocument> =
  model<EmailVerificationDocument>('EmailVerification', emailVerificationSchema);
