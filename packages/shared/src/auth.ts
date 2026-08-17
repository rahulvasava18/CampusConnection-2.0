export const PLATFORM_ROLES = [
  'STUDENT',
  'COMMUNITY_ADMIN',
  'COMMUNITY_MODERATOR',
  'CLUB_ORG_ADMIN',
  'MENTOR',
  'COLLEGE_ADMIN',
  'PLATFORM_ADMIN',
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ACCOUNT_STATES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
  'BANNED',
  'DELETED',
] as const;

export type AccountState = (typeof ACCOUNT_STATES)[number];
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED';

export interface UserNotificationPreferences {
  messages: boolean;
  teamActivity: boolean;
  projectActivity: boolean;
  communityActivity: boolean;
  eventUpdates: boolean;
  socialInteractions: boolean;
}

export interface UserPrivacyPreferences {
  profileDiscoverable: boolean;
  showInRecommendations: boolean;
}

export interface UserPreferences {
  notifications: UserNotificationPreferences;
  privacy: UserPrivacyPreferences;
}

export interface UserSettingsView {
  email: string;
  username: string;
  displayName: string;
  preferences: UserPreferences;
}

export interface UserView {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  college?: string;
  department?: string;
  course?: string;
  graduationYear?: number;
  skills: string[];
  interests: string[];
  goals: string[];
  avatarUrl?: string;
  accountState: AccountState;
  verificationStatus: VerificationStatus;
  roles: PlatformRole[];
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface SessionView {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  userAgent?: string;
  ipAddress?: string;
  isCurrent: boolean;
}
