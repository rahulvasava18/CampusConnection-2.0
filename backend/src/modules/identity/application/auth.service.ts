import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import type { AccountState, EventType, SessionView, UserView } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { OutboxEventPublisher } from '../../../infrastructure/events/event-publisher';
import { logger } from '../../../shared/logging/logger';
import { getEnv } from '../../../config/env';
import {
  authRateRule,
  RedisRateLimiter,
} from '../../../infrastructure/rate-limit/redis-rate-limiter';
import { createOpaqueToken, hashOpaqueToken } from '../security/token.service';
import { hashPassword, verifyPassword } from '../security/password.service';
import {
  normalizeEmail,
  normalizeIdentifier,
  normalizeUsername,
} from '../security/credential-normalization';
import { signAccessToken } from '../security/jwt.service';
import {
  EmailVerificationRepository,
  PendingSignupRepository,
  UserRepository,
  SessionRepository,
  SecurityAuditRepository,
} from '../infrastructure/identity.repositories';
import { type UserDocument } from '../infrastructure/user.model';
import { toUserView } from './user.mapper';
import type { AuthContext, RequestMeta } from '../interfaces/auth.types';

export interface ProfileUpdateInput {
  displayName?: string;
  bio?: string;
  college?: string;
  department?: string;
  course?: string;
  graduationYear?: number;
  skills?: string[];
  interests?: string[];
  goals?: string[];
  avatarUrl?: string;
}

export interface AuthSessionResult {
  user: UserView;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  sessionId: string;
}

interface ServiceDependencies {
  users?: UserRepository;
  emailVerifications?: EmailVerificationRepository;
  pendingSignups?: PendingSignupRepository;
  sessions?: SessionRepository;
  audits?: SecurityAuditRepository;
  events?: OutboxEventPublisher;
  rateLimiter?: RedisRateLimiter;
}

export class AuthService {
  private readonly users: UserRepository;
  private readonly emailVerifications: EmailVerificationRepository;
  private readonly pendingSignups: PendingSignupRepository;
  private readonly sessions: SessionRepository;
  private readonly audits: SecurityAuditRepository;
  private readonly events: OutboxEventPublisher;
  private readonly rateLimiter: RedisRateLimiter;

  public constructor(dependencies: ServiceDependencies = {}) {
    this.users = dependencies.users ?? new UserRepository();
    this.emailVerifications = dependencies.emailVerifications ?? new EmailVerificationRepository();
    this.pendingSignups = dependencies.pendingSignups ?? new PendingSignupRepository();
    this.sessions = dependencies.sessions ?? new SessionRepository();
    this.audits = dependencies.audits ?? new SecurityAuditRepository();
    this.events = dependencies.events ?? new OutboxEventPublisher();
    this.rateLimiter = dependencies.rateLimiter ?? new RedisRateLimiter();
  }

  public async signup(
    input: { displayName: string; username: string; email: string; password: string },
    meta: RequestMeta,
  ): Promise<{ email: string }> {
    await this.limit('signup', meta.ipAddress ?? 'unknown');
    const email = normalizeEmail(input.email);
    const username = normalizeUsername(input.username);
    const passwordHash = await hashPassword(input.password);
    const correlationId = meta.correlationId ?? meta.requestId ?? randomUUID();
    try {
      await this.transaction(async (session) => {
        const existing = await this.users.findByEmail(email, session);
        const usernameOwner = await this.users.findByUsername(username, session);
        if (usernameOwner)
          throw new AppError('USERNAME_ALREADY_EXISTS', 'That username is already in use.', 409);
        if (existing)
          throw new AppError(
            'EMAIL_ALREADY_EXISTS',
            'An account with that email already exists. Please log in.',
            409,
          );
        await this.pendingSignups.deleteByCredentials(email, username, session);
        const token = createOpaqueToken(32);
        const signup = await this.pendingSignups.create(
          {
            displayName: input.displayName.trim(),
            usernameNormalized: username,
            emailNormalized: email,
            passwordHash,
            verificationTokenHash: hashOpaqueToken(token),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
          session,
        );
        await this.events.record(
          {
            eventType: 'VERIFICATION_EMAIL_REQUESTED',
            producer: 'identity',
            aggregateType: 'PendingSignup',
            aggregateId: signup.id,
            correlationId,
            payload: {
              to: email,
              displayName: signup.displayName,
              token,
            },
          },
          session,
        );
      });
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new AppError(
          'USERNAME_OR_EMAIL_ALREADY_EXISTS',
          'That username or email is already in use.',
          409,
        );
      throw error;
    }
    return { email };
  }

  public async verifyEmail(token: string, meta: RequestMeta): Promise<void> {
    await this.limit('verify', meta.ipAddress ?? 'unknown');
    const tokenHash = hashOpaqueToken(token);
    try {
      await this.transaction(async (session) => {
        const pending = await this.pendingSignups.findByTokenHash(tokenHash, session);
        if (!pending) {
          const legacyVerification = await this.emailVerifications.findByTokenHash(
            tokenHash,
            session,
          );
          if (!legacyVerification || legacyVerification.expiresAt <= new Date())
            throw new AppError(
              'VERIFICATION_TOKEN_INVALID',
              'This verification link is invalid or expired.',
              400,
            );
          const legacyUser = await this.users.findById(legacyVerification.userId, session);
          if (!legacyUser)
            throw new AppError(
              'VERIFICATION_TOKEN_INVALID',
              'This verification link is invalid or expired.',
              400,
            );
          this.assertCanAuthenticate(legacyUser);
          legacyUser.verificationStatus = 'VERIFIED';
          if (legacyUser.accountState === 'PENDING_VERIFICATION')
            legacyUser.accountState = 'ACTIVE';
          await legacyUser.save({ session });
          await this.emailVerifications.delete(legacyVerification, session);
          await this.events.record(
            {
              eventType: 'USER_VERIFIED',
              producer: 'identity',
              aggregateType: 'User',
              aggregateId: legacyUser.id,
              actorId: legacyUser.id,
              correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
              payload: { userId: legacyUser.id, verificationMethod: 'email' },
            },
            session,
          );
          return;
        }
        if (pending.expiresAt <= new Date())
          throw new AppError(
            'VERIFICATION_TOKEN_INVALID',
            'This verification link is invalid or expired.',
            400,
          );
        const existingEmail = await this.users.findByEmail(pending.emailNormalized, session);
        if (existingEmail)
          throw new AppError(
            'EMAIL_ALREADY_EXISTS',
            'An account with that email already exists. Please log in.',
            409,
          );
        const existingUsername = await this.users.findByUsername(
          pending.usernameNormalized,
          session,
        );
        if (existingUsername)
          throw new AppError('USERNAME_ALREADY_EXISTS', 'That username is already in use.', 409);
        const user = await this.users.create(
          {
            username: pending.usernameNormalized,
            usernameNormalized: pending.usernameNormalized,
            email: pending.emailNormalized,
            emailNormalized: pending.emailNormalized,
            displayName: pending.displayName,
            passwordHash: pending.passwordHash,
            skills: [],
            interests: [],
            goals: [],
            accountState: 'ACTIVE',
            verificationStatus: 'VERIFIED',
            roles: ['STUDENT'],
          },
          session,
        );
        await this.pendingSignups.delete(pending, session);
        const correlationId = meta.correlationId ?? meta.requestId ?? randomUUID();
        await this.events.record(
          {
            eventType: 'USER_REGISTERED',
            producer: 'identity',
            aggregateType: 'User',
            aggregateId: user.id,
            actorId: user.id,
            correlationId,
            payload: { userId: user.id, emailDomain: pending.emailNormalized.split('@')[1] ?? '' },
          },
          session,
        );
        await this.events.record(
          {
            eventType: 'USER_VERIFIED',
            producer: 'identity',
            aggregateType: 'User',
            aggregateId: user.id,
            actorId: user.id,
            correlationId,
            payload: { userId: user.id, verificationMethod: 'email' },
          },
          session,
        );
      });
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new AppError(
          'USERNAME_OR_EMAIL_ALREADY_EXISTS',
          'That username or email is already in use.',
          409,
        );
      throw error;
    }
  }

  public async resendVerification(
    identifier: string,
    meta: RequestMeta,
  ): Promise<{ email: string }> {
    await this.limit('resend', meta.ipAddress ?? 'unknown');
    const normalized = normalizeIdentifier(identifier);
    const pendingSignup = await this.pendingSignups.findByIdentifier(normalized);
    if (pendingSignup) {
      const token = createOpaqueToken(32);
      await this.transaction(async (session) => {
        await this.pendingSignups.replaceToken(
          pendingSignup,
          hashOpaqueToken(token),
          new Date(Date.now() + 30 * 60 * 1000),
          session,
        );
        await this.events.record(
          {
            eventType: 'VERIFICATION_EMAIL_REQUESTED',
            producer: 'identity',
            aggregateType: 'PendingSignup',
            aggregateId: pendingSignup.id,
            correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
            payload: {
              to: pendingSignup.emailNormalized,
              displayName: pendingSignup.displayName,
              token,
            },
          },
          session,
        );
      });
      return { email: pendingSignup.emailNormalized };
    }
    const user = await this.users.findByIdentifier(normalized);
    if (!user)
      throw new AppError(
        'ACCOUNT_NOT_FOUND',
        'No account was found for that email or username.',
        404,
      );
    if (user.verificationStatus === 'VERIFIED')
      throw new AppError(
        'EMAIL_ALREADY_VERIFIED',
        'This email is already verified. You can log in.',
        409,
      );
    this.assertCanAuthenticate(user);
    const token = createOpaqueToken(32);
    await this.transaction(async (session) => {
      await this.emailVerifications.deleteForUser(user._id, session);
      await this.emailVerifications.create(
        {
          userId: user._id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
        session,
      );
      await this.events.record(
        {
          eventType: 'VERIFICATION_EMAIL_REQUESTED',
          producer: 'identity',
          aggregateType: 'User',
          aggregateId: user.id,
          actorId: user.id,
          correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
          payload: {
            to: user.email,
            displayName: user.displayName,
            token,
          },
        },
        session,
      );
    });
    return { email: user.email };
  }

  public async login(
    identifier: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthSessionResult> {
    await this.limit('login', meta.ipAddress ?? 'unknown');
    const user = await this.users.findByIdentifier(normalizeIdentifier(identifier));
    const valid = await verifyPassword(password, user?.passwordHash);
    if (!user || !valid)
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username/email or password.', 401);
    this.assertCanAuthenticate(user);
    if (user.verificationStatus !== 'VERIFIED')
      throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email before signing in.', 403);
    const result = await this.createSession(user, meta);
    await this.recordAudit('PASSWORD_LOGIN_SUCCESS', user._id, meta);
    return result;
  }

  public async refresh(
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<AuthSessionResult> {
    if (!refreshToken)
      throw new AppError('REFRESH_TOKEN_INVALID', 'The session is invalid or expired.', 401);
    const existing = await this.sessions.findByTokenHash(hashOpaqueToken(refreshToken));
    if (!existing)
      throw new AppError('REFRESH_TOKEN_INVALID', 'The session is invalid or expired.', 401);
    if (existing.status !== 'ACTIVE') {
      if (existing.status === 'ROTATED') {
        await this.sessions.revokeFamily(existing.familyId);
        await this.recordAudit('REFRESH_REUSE_DETECTED', existing.userId, meta, {
          familyId: existing.familyId,
        });
        throw new AppError(
          'REFRESH_TOKEN_REUSE_DETECTED',
          'The session is no longer valid. Please sign in again.',
          401,
        );
      }
      throw new AppError(
        'REFRESH_TOKEN_REVOKED',
        'The session is no longer valid. Please sign in again.',
        401,
      );
    }
    if (existing.expiresAt <= new Date())
      throw new AppError(
        'REFRESH_TOKEN_EXPIRED',
        'The session is expired. Please sign in again.',
        401,
      );
    const user = await this.users.findById(existing.userId);
    if (!user)
      throw new AppError('REFRESH_TOKEN_INVALID', 'The session is invalid or expired.', 401);
    this.assertCanAuthenticate(user);
    const result = await this.transaction(async (session) => {
      const newRefreshToken = createOpaqueToken();
      const replacement = await this.sessions.create(
        {
          userId: user._id,
          tokenHash: hashOpaqueToken(newRefreshToken),
          familyId: existing.familyId,
          status: 'ACTIVE',
          expiresAt: this.refreshExpiry(),
          lastUsedAt: new Date(),
          ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
          ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        },
        session,
      );
      const rotated = await this.sessions.rotateIfActive(existing, replacement._id, session);
      if (!rotated) {
        await this.sessions.revokeFamily(existing.familyId, session);
        throw new AppError(
          'REFRESH_TOKEN_REUSE_DETECTED',
          'The session is no longer valid. Please sign in again.',
          401,
        );
      }
      await this.events.record(
        {
          eventType: 'SESSION_REFRESHED',
          producer: 'identity',
          aggregateType: 'Session',
          aggregateId: replacement.id,
          actorId: user.id,
          correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
          payload: { userId: user.id, familyId: existing.familyId },
        },
        session,
      );
      return { replacement, newRefreshToken };
    });
    return {
      user: toUserView(user),
      accessToken: signAccessToken({
        sub: user.id,
        sid: result.replacement.id,
        fid: existing.familyId,
        roles: user.roles,
      }),
      refreshToken: result.newRefreshToken,
      csrfToken: createOpaqueToken(),
      sessionId: result.replacement.id,
    };
  }

  public async logout(context: AuthContext, meta: RequestMeta): Promise<void> {
    const session = await this.sessions.findByIdForUser(
      new Types.ObjectId(context.userId),
      context.sessionId,
    );
    if (session && session.status === 'ACTIVE') {
      await this.sessions.revoke(session);
      await this.events.record({
        eventType: 'SESSION_REVOKED',
        producer: 'identity',
        aggregateType: 'Session',
        aggregateId: session.id,
        actorId: context.userId,
        correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
        payload: { userId: context.userId, reason: 'LOGOUT' },
      });
      await this.recordAudit('SESSION_REVOKED', new Types.ObjectId(context.userId), meta, {
        reason: 'LOGOUT',
      });
    }
  }

  public async logoutAll(context: AuthContext, meta: RequestMeta): Promise<void> {
    await this.sessions.revokeAllForUser(new Types.ObjectId(context.userId));
    await this.events.record({
      eventType: 'SESSION_REVOKED',
      producer: 'identity',
      aggregateType: 'User',
      aggregateId: context.userId,
      actorId: context.userId,
      correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
      payload: { userId: context.userId, reason: 'LOGOUT_ALL' },
    });
    await this.recordAudit('ALL_SESSIONS_REVOKED', new Types.ObjectId(context.userId), meta);
  }

  public async revokeOtherSessions(context: AuthContext, meta: RequestMeta): Promise<number> {
    const revokedCount = await this.sessions.revokeOthersForUser(
      new Types.ObjectId(context.userId),
      context.sessionId,
    );
    await this.recordAudit('OTHER_SESSIONS_REVOKED', new Types.ObjectId(context.userId), meta, {
      revokedCount,
    });
    return revokedCount;
  }

  public async updateProfile(
    context: AuthContext,
    input: ProfileUpdateInput,
    meta: RequestMeta,
  ): Promise<UserView> {
    const user = await this.users.findById(context.userId);
    if (!user) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
    const changes = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
    await this.transaction(async (session) => {
      Object.assign(user, changes);
      await user.save({ session });
      const eventType: EventType = 'PROFILE_UPDATED';
      await this.events.record(
        {
          eventType,
          producer: 'identity',
          aggregateType: 'User',
          aggregateId: user.id,
          actorId: user.id,
          correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
          payload: { userId: user.id, fields: Object.keys(changes) },
        },
        session,
      );
    });
    return toUserView(user);
  }

  public async listSessions(context: AuthContext): Promise<SessionView[]> {
    const sessions = await this.sessions.listForUser(new Types.ObjectId(context.userId));
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      ...(session.userAgent ? { userAgent: session.userAgent } : {}),
      ...(session.ipAddress ? { ipAddress: session.ipAddress } : {}),
      isCurrent: session.id === context.sessionId,
    }));
  }

  public async revokeSession(
    context: AuthContext,
    sessionId: string,
    meta: RequestMeta,
  ): Promise<void> {
    const revoked = await this.sessions.revokeById(new Types.ObjectId(context.userId), sessionId);
    if (!revoked) throw new AppError('SESSION_NOT_FOUND', 'The session was not found.', 404);
    await this.recordAudit('SESSION_REVOKED', new Types.ObjectId(context.userId), meta, {
      sessionId,
    });
  }

  private async createSession(user: UserDocument, meta: RequestMeta): Promise<AuthSessionResult> {
    const refreshToken = createOpaqueToken();
    const csrfToken = createOpaqueToken();
    const familyId = randomUUID();
    const session = await this.transaction(async (dbSession) => {
      const created = await this.sessions.create(
        {
          userId: user._id,
          tokenHash: hashOpaqueToken(refreshToken),
          familyId,
          status: 'ACTIVE',
          expiresAt: this.refreshExpiry(),
          lastUsedAt: new Date(),
          ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
          ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        },
        dbSession,
      );
      await this.events.record(
        {
          eventType: 'USER_LOGGED_IN',
          producer: 'identity',
          aggregateType: 'Session',
          aggregateId: created.id,
          actorId: user.id,
          correlationId: meta.correlationId ?? meta.requestId ?? randomUUID(),
          payload: { userId: user.id, sessionId: created.id },
        },
        dbSession,
      );
      return created;
    });
    return {
      user: toUserView(user),
      accessToken: signAccessToken({
        sub: user.id,
        sid: session.id,
        fid: familyId,
        roles: user.roles,
      }),
      refreshToken,
      csrfToken,
      sessionId: session.id,
    };
  }

  private assertCanAuthenticate(user: UserDocument): void {
    const blocked: AccountState[] = ['BANNED', 'DELETED', 'SUSPENDED'];
    if (blocked.includes(user.accountState))
      throw new AppError('ACCOUNT_UNAVAILABLE', 'This account cannot authenticate.', 403);
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + getEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private async limit(kind: Parameters<typeof authRateRule>[0], key: string): Promise<void> {
    const result = await this.rateLimiter.consume(`${kind}:${key}`, authRateRule(kind));
    if (!result.allowed)
      throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.', 429, {
        retryAfterSeconds: result.retryAfterSeconds,
      });
  }

  private async recordAudit(
    action: string,
    actorId: Types.ObjectId | undefined,
    meta: RequestMeta,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.audits.record({
        ...(actorId ? { actorId } : {}),
        action,
        ...(meta.requestId ? { requestId: meta.requestId } : {}),
        ...(meta.correlationId ? { correlationId: meta.correlationId } : {}),
        metadata,
      });
    } catch (error) {
      logger.error({ err: error, action }, 'Security audit persistence failed');
    }
  }

  private async transaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
