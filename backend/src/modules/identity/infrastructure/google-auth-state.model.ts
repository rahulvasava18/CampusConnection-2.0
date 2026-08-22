import { Schema, model, type Document, type Model, type ClientSession, type Types } from 'mongoose';

export type GoogleAuthStateStatus = 'STARTED' | 'READY' | 'ONBOARDING' | 'CONSUMED';
export type GoogleAuthPurpose = 'SIGN_IN' | 'PASSWORD_RECOVERY';

export interface GoogleAuthStateDocument extends Document {
  stateHash: string;
  nonce: string;
  purpose: GoogleAuthPurpose;
  userId?: Types.ObjectId;
  sessionId?: string;
  familyId?: string;
  handoffTokenHash?: string;
  onboardingTokenHash?: string;
  status: GoogleAuthStateStatus;
  googleId?: string;
  email?: string;
  displayName?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<GoogleAuthStateDocument>(
  {
    stateHash: { type: String, required: true, unique: true, index: true },
    nonce: { type: String, required: true },
    purpose: { type: String, enum: ['SIGN_IN', 'PASSWORD_RECOVERY'], default: 'SIGN_IN' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String },
    familyId: { type: String },
    handoffTokenHash: { type: String, unique: true, sparse: true, index: true },
    onboardingTokenHash: { type: String, unique: true, sparse: true, index: true },
    status: {
      type: String,
      enum: ['STARTED', 'READY', 'ONBOARDING', 'CONSUMED'],
      required: true,
      index: true,
    },
    googleId: { type: String },
    email: { type: String },
    displayName: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'google_auth_states', timestamps: true },
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GoogleAuthStateModel: Model<GoogleAuthStateDocument> = model(
  'GoogleAuthState',
  schema,
);

export class GoogleAuthStateRepository {
  public create(
    input: Pick<
      GoogleAuthStateDocument,
      'stateHash' | 'nonce' | 'purpose' | 'userId' | 'sessionId' | 'familyId' | 'status' | 'expiresAt'
    >,
  ): Promise<GoogleAuthStateDocument> {
    return GoogleAuthStateModel.create(input);
  }

  public findStarted(stateHash: string): Promise<GoogleAuthStateDocument | null> {
    return GoogleAuthStateModel.findOne({
      stateHash,
      status: 'STARTED',
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  public markReady(
    document: GoogleAuthStateDocument,
    input: Pick<GoogleAuthStateDocument, 'handoffTokenHash' | 'googleId' | 'email' | 'displayName'>,
  ): Promise<GoogleAuthStateDocument | null> {
    return GoogleAuthStateModel.findOneAndUpdate(
      { _id: document._id, status: 'STARTED', expiresAt: { $gt: new Date() } },
      { $set: { ...input, status: 'READY' } },
      { new: true },
    ).exec();
  }

  public consumeHandoff(handoffTokenHash: string): Promise<GoogleAuthStateDocument | null> {
    return GoogleAuthStateModel.findOneAndUpdate(
      { handoffTokenHash, status: 'READY', expiresAt: { $gt: new Date() } },
      { $set: { status: 'CONSUMED' } },
      { new: true },
    ).exec();
  }

  public moveToOnboarding(
    handoffTokenHash: string,
    onboardingTokenHash: string,
  ): Promise<GoogleAuthStateDocument | null> {
    return GoogleAuthStateModel.findOneAndUpdate(
      { handoffTokenHash, status: 'CONSUMED', expiresAt: { $gt: new Date() } },
      { $set: { status: 'ONBOARDING', onboardingTokenHash } },
      { new: true },
    ).exec();
  }

  public findOnboarding(
    onboardingTokenHash: string,
    session?: ClientSession,
  ): Promise<GoogleAuthStateDocument | null> {
    return GoogleAuthStateModel.findOne({
      onboardingTokenHash,
      status: 'ONBOARDING',
      expiresAt: { $gt: new Date() },
    })
      .session(session ?? null)
      .exec();
  }

  public async consumeOnboarding(
    document: GoogleAuthStateDocument,
    session?: ClientSession,
  ): Promise<void> {
    document.status = 'CONSUMED';
    await document.save(session ? { session } : {});
  }
}
