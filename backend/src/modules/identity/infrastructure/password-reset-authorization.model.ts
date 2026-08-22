import { Schema, model, type ClientSession, type Document, type Model, type Types } from 'mongoose';

export interface PasswordResetAuthorizationDocument extends Document {
  tokenHash: string;
  userId: Types.ObjectId;
  familyId: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<PasswordResetAuthorizationDocument>(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { collection: 'password_reset_authorizations', timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetAuthorizationModel: Model<PasswordResetAuthorizationDocument> = model(
  'PasswordResetAuthorization',
  schema,
);

export class PasswordResetAuthorizationRepository {
  public create(
    input: Pick<PasswordResetAuthorizationDocument, 'tokenHash' | 'userId' | 'familyId' | 'expiresAt'>,
    session?: ClientSession,
  ): Promise<PasswordResetAuthorizationDocument> {
    return PasswordResetAuthorizationModel.create([input], { session }).then(([document]) => {
      if (!document) throw new Error('Password reset authorization creation returned no document');
      return document;
    });
  }

  public consumeForUserSession(
    tokenHash: string,
    userId: Types.ObjectId,
    familyId: string,
    session?: ClientSession,
  ): Promise<PasswordResetAuthorizationDocument | null> {
    const query = PasswordResetAuthorizationModel.findOneAndUpdate(
      { tokenHash, userId, familyId, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true },
    );
    if (session) query.session(session);
    return query.exec();
  }
}
