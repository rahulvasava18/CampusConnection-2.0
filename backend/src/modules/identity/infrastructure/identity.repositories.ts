import type { ClientSession, Types } from 'mongoose';
import { UserModel, type UserDocument } from './user.model';
import { SessionModel, type SessionDocument } from './session.model';
import { RoleAssignmentModel, type RoleAssignmentDocument } from './role-assignment.model';
import { SecurityAuditModel, type SecurityAuditDocument } from './security-audit.model';
import { EmailVerificationModel, type EmailVerificationDocument } from './email-verification.model';
import { PendingSignupModel, type PendingSignupDocument } from './pending-signup.model';

export class UserRepository {
  public async findByEmail(
    email: string,
    session?: ClientSession,
    includePasswordHash = false,
  ): Promise<UserDocument | null> {
    const normalized = email.toLowerCase();
    const query = UserModel.findOne({
      $or: [{ emailNormalized: normalized }, { email: normalized }],
    });
    if (includePasswordHash) query.select('+passwordHash');
    return query
      .collation({ locale: 'en', strength: 2 })
      .session(session ?? null)
      .exec();
  }

  public async findByUsername(
    username: string,
    session?: ClientSession,
    includePasswordHash = false,
  ): Promise<UserDocument | null> {
    const normalized = username.toLowerCase();
    const query = UserModel.findOne({
      $or: [{ usernameNormalized: normalized }, { username: normalized }],
    });
    if (includePasswordHash) query.select('+passwordHash');
    return query
      .collation({ locale: 'en', strength: 2 })
      .session(session ?? null)
      .exec();
  }

  public async findByIdentifier(
    identifier: string,
    session?: ClientSession,
  ): Promise<UserDocument | null> {
    const normalized = identifier.toLowerCase();
    const query = normalized.includes('@')
      ? UserModel.findOne({ $or: [{ emailNormalized: normalized }, { email: normalized }] })
      : UserModel.findOne({
          $or: [{ usernameNormalized: normalized }, { username: normalized }],
        });
    return query
      .collation({ locale: 'en', strength: 2 })
      .select('+passwordHash')
      .session(session ?? null)
      .exec();
  }

  public async findById(
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<UserDocument | null> {
    return UserModel.findById(id)
      .session(session ?? null)
      .exec();
  }

  public async findByIds(ids: Types.ObjectId[], session?: ClientSession): Promise<UserDocument[]> {
    return UserModel.find({ _id: { $in: ids } })
      .select('username displayName avatarUrl college course skills')
      .session(session ?? null)
      .exec();
  }

  public async create(
    input: Partial<UserDocument>,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const [user] = await UserModel.create([input], { session });
    if (!user) throw new Error('User creation returned no document');
    return user;
  }

  public async update(
    user: UserDocument,
    changes: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<UserDocument> {
    Object.assign(user, changes);
    return user.save(session ? { session } : {});
  }
}

export class EmailVerificationRepository {
  public async deleteForUser(userId: Types.ObjectId, session?: ClientSession): Promise<void> {
    await EmailVerificationModel.deleteMany({ userId }, session ? { session } : {}).exec();
  }

  public async create(
    input: Pick<EmailVerificationDocument, 'userId' | 'tokenHash' | 'expiresAt'>,
    session?: ClientSession,
  ): Promise<EmailVerificationDocument> {
    const [document] = await EmailVerificationModel.create([input], { session });
    if (!document) throw new Error('Email verification creation returned no document');
    return document;
  }

  public async findByTokenHash(
    tokenHash: string,
    session?: ClientSession,
  ): Promise<EmailVerificationDocument | null> {
    return EmailVerificationModel.findOne({ tokenHash })
      .session(session ?? null)
      .exec();
  }

  public async delete(document: EmailVerificationDocument, session?: ClientSession): Promise<void> {
    await EmailVerificationModel.deleteOne(
      { _id: document._id },
      session ? { session } : {},
    ).exec();
  }
}

export class PendingSignupRepository {
  public async findByCredentials(
    emailNormalized: string,
    usernameNormalized: string,
    session?: ClientSession,
  ): Promise<PendingSignupDocument | null> {
    return PendingSignupModel.findOne({
      $or: [{ emailNormalized }, { usernameNormalized }],
    })
      .select('+passwordHash +verificationTokenHash')
      .session(session ?? null)
      .exec();
  }

  public async findByIdentifier(
    identifier: string,
    session?: ClientSession,
  ): Promise<PendingSignupDocument | null> {
    const field = identifier.includes('@')
      ? { emailNormalized: identifier }
      : { usernameNormalized: identifier };
    return PendingSignupModel.findOne(field)
      .select('+passwordHash +verificationTokenHash')
      .session(session ?? null)
      .exec();
  }

  public async findByTokenHash(
    tokenHash: string,
    session?: ClientSession,
  ): Promise<PendingSignupDocument | null> {
    return PendingSignupModel.findOne({ verificationTokenHash: tokenHash })
      .select('+passwordHash +verificationTokenHash')
      .session(session ?? null)
      .exec();
  }

  public async create(
    input: Pick<
      PendingSignupDocument,
      | 'displayName'
      | 'usernameNormalized'
      | 'emailNormalized'
      | 'passwordHash'
      | 'verificationTokenHash'
      | 'expiresAt'
    >,
    session?: ClientSession,
  ): Promise<PendingSignupDocument> {
    const [document] = await PendingSignupModel.create([input], { session });
    if (!document) throw new Error('Pending signup creation returned no document');
    return document;
  }

  public async delete(document: PendingSignupDocument, session?: ClientSession): Promise<void> {
    await PendingSignupModel.deleteOne({ _id: document._id }, session ? { session } : {}).exec();
  }

  public async deleteByCredentials(
    emailNormalized: string,
    usernameNormalized: string,
    session?: ClientSession,
  ): Promise<void> {
    await PendingSignupModel.deleteMany(
      { $or: [{ emailNormalized }, { usernameNormalized }] },
      session ? { session } : {},
    ).exec();
  }

  public async deleteById(id: Types.ObjectId, session?: ClientSession): Promise<void> {
    await PendingSignupModel.deleteOne({ _id: id }, session ? { session } : {}).exec();
  }

  public async replaceToken(
    document: PendingSignupDocument,
    tokenHash: string,
    expiresAt: Date,
    session?: ClientSession,
  ): Promise<PendingSignupDocument> {
    document.verificationTokenHash = tokenHash;
    document.expiresAt = expiresAt;
    return document.save(session ? { session } : {});
  }
}

export class SessionRepository {
  public async create(
    input: Partial<SessionDocument>,
    session?: ClientSession,
  ): Promise<SessionDocument> {
    const [document] = await SessionModel.create([input], { session });
    if (!document) throw new Error('Session creation returned no document');
    return document;
  }

  public async findByTokenHash(
    tokenHash: string,
    session?: ClientSession,
  ): Promise<SessionDocument | null> {
    return SessionModel.findOne({ tokenHash })
      .session(session ?? null)
      .exec();
  }

  public async rotateIfActive(
    document: SessionDocument,
    replacementId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: document._id, status: 'ACTIVE', expiresAt: { $gt: new Date() } },
      {
        $set: {
          status: 'ROTATED',
          rotatedAt: new Date(),
          replacedBySessionId: replacementId,
          lastUsedAt: new Date(),
        },
      },
      session ? { session } : {},
    ).exec();
    return result.modifiedCount === 1;
  }

  public async findByIdForUser(
    userId: Types.ObjectId,
    sessionId: string,
  ): Promise<SessionDocument | null> {
    return SessionModel.findOne({ _id: sessionId, userId }).exec();
  }

  public async findActiveForUser(
    userId: string,
    sessionId: string,
    familyId: string,
  ): Promise<SessionDocument | null> {
    return SessionModel.findOne({
      _id: sessionId,
      userId,
      familyId,
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    }).exec();
  }

  public async revoke(
    document: SessionDocument,
    session?: ClientSession,
  ): Promise<SessionDocument> {
    document.status = 'REVOKED';
    document.revokedAt = new Date();
    return document.save(session ? { session } : {});
  }

  public async revokeFamily(familyId: string, session?: ClientSession): Promise<void> {
    await SessionModel.updateMany(
      { familyId, status: { $in: ['ACTIVE', 'ROTATED'] } },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
      session ? { session } : {},
    );
  }

  public async revokeAllForUser(userId: Types.ObjectId, session?: ClientSession): Promise<void> {
    await SessionModel.updateMany(
      { userId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
      session ? { session } : {},
    );
  }

  public async revokeOthersForUser(
    userId: Types.ObjectId,
    currentSessionId: string,
  ): Promise<number> {
    const result = await SessionModel.updateMany(
      { userId, status: 'ACTIVE', _id: { $ne: currentSessionId } },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
    ).exec();
    return result.modifiedCount;
  }

  public async listForUser(userId: Types.ObjectId): Promise<SessionDocument[]> {
    return SessionModel.find({ userId, status: 'ACTIVE', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  public async revokeById(userId: Types.ObjectId, sessionId: string): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: sessionId, userId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  }
}

export class RoleAssignmentRepository {
  public async findForUser(userId: Types.ObjectId): Promise<RoleAssignmentDocument[]> {
    return RoleAssignmentModel.find({ userId }).exec();
  }
}

export class SecurityAuditRepository {
  public async record(
    input: Partial<SecurityAuditDocument>,
    session?: ClientSession,
  ): Promise<SecurityAuditDocument> {
    const [document] = await SecurityAuditModel.create([input], { session });
    if (!document) throw new Error('Audit creation returned no document');
    return document;
  }
}
