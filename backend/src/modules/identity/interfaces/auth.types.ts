import type { PlatformRole, UserView } from '@campusconnection/shared';

export interface AuthContext {
  userId: string;
  sessionId: string;
  familyId: string;
  roles: PlatformRole[];
  user: UserView;
}

export interface RequestMeta {
  requestId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}
