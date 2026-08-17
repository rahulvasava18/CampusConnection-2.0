import { Schema, model, type Document, type Model } from 'mongoose';

export interface PendingSignupDocument extends Document {
  displayName: string;
  usernameNormalized: string;
  emailNormalized: string;
  passwordHash: string;
  verificationTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const pendingSignupSchema = new Schema<PendingSignupDocument>(
  {
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    usernameNormalized: { type: String, required: true, lowercase: true, trim: true, unique: true },
    emailNormalized: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    verificationTokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'pending_signups', timestamps: { createdAt: true, updatedAt: false } },
);

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingSignupModel: Model<PendingSignupDocument> = model<PendingSignupDocument>(
  'PendingSignup',
  pendingSignupSchema,
);
