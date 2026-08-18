import type { UserPreferences, UserSettingsView } from '@campusconnection/shared';
import { AppError } from '../../../shared/errors/app-error';
import { DomainEventRecorder } from '../../../infrastructure/events/domain-event';
import { withMongoTransaction } from '../../collaboration/application/collaboration.transaction';
import { UserModel } from '../../identity/infrastructure/user.model';
import type { AuthContext } from '../../identity/interfaces/auth.types';
import { hashPassword, verifyPassword } from '../../identity/security/password.service';

const defaultPreferences: UserPreferences = {
  notifications: {
    messages: true,
    teamActivity: true,
    projectActivity: true,
    communityActivity: true,
    eventUpdates: true,
    socialInteractions: true,
  },
  privacy: {
    profileDiscoverable: true,
    showInRecommendations: true,
  },
};

export interface SettingsUpdateInput {
  preferences: Partial<{
    notifications: Partial<UserPreferences['notifications']>;
    privacy: Partial<UserPreferences['privacy']>;
  }>;
}

export class SettingsService {
  public constructor(private readonly events = new DomainEventRecorder()) {}

  private active(context: AuthContext) {
    if (!['ACTIVE', 'RESTRICTED'].includes(context.user.accountState))
      throw new AppError('ACCOUNT_RESTRICTED', 'Your account cannot access settings.', 403);
  }

  private preferences(user: { preferences?: UserPreferences }): UserPreferences {
    return {
      notifications: {
        ...defaultPreferences.notifications,
        ...(user.preferences?.notifications ?? {}),
      },
      privacy: {
        ...defaultPreferences.privacy,
        ...(user.preferences?.privacy ?? {}),
      },
    };
  }

  private view(user: {
    email: string;
    username: string;
    displayName: string;
    passwordHash?: string;
    preferences?: UserPreferences;
  }): UserSettingsView {
    return {
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      passwordConfigured: Boolean(user.passwordHash),
      preferences: this.preferences(user),
    };
  }

  public async get(context: AuthContext): Promise<UserSettingsView> {
    this.active(context);
    const user = await UserModel.findById(context.userId).select('+passwordHash').exec();
    if (!user) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
    return this.view(user);
  }

  public async update(
    context: AuthContext,
    input: SettingsUpdateInput,
    correlationId: string,
  ): Promise<UserSettingsView> {
    this.active(context);
    const user = await UserModel.findById(context.userId).select('+passwordHash').exec();
    if (!user) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
    user.preferences = {
      notifications: {
        ...this.preferences(user).notifications,
        ...(input.preferences.notifications ?? {}),
      },
      privacy: {
        ...this.preferences(user).privacy,
        ...(input.preferences.privacy ?? {}),
      },
    };
    await withMongoTransaction(async (session) => {
      await user.save({ session });
      await this.events.record(
        {
          eventType: 'PROFILE_UPDATED',
          producer: 'identity',
          aggregateType: 'User',
          aggregateId: user.id,
          actorId: user.id,
          correlationId,
          payload: { userId: user.id, fields: ['preferences'] },
        },
        session,
      );
    });
    return this.view(user);
  }

  public async setPassword(
    context: AuthContext,
    input: { currentPassword?: string; newPassword: string },
    correlationId: string,
  ): Promise<UserSettingsView> {
    this.active(context);
    const user = await UserModel.findById(context.userId).select('+passwordHash').exec();
    if (!user) throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.', 401);
    if (user.passwordHash && !(await verifyPassword(input.currentPassword ?? '', user.passwordHash)))
      throw new AppError('INVALID_CURRENT_PASSWORD', 'The current password is incorrect.', 401);
    user.passwordHash = await hashPassword(input.newPassword);
    await withMongoTransaction(async (session) => {
      await user.save({ session });
      await this.events.record(
        {
          eventType: 'PROFILE_UPDATED',
          producer: 'identity',
          aggregateType: 'User',
          aggregateId: user.id,
          actorId: user.id,
          correlationId,
          payload: { userId: user.id, fields: ['passwordHash'] },
        },
        session,
      );
    });
    return this.view(user);
  }
}
