import type { UserView } from '@campusconnection/shared';
import type { UserDocument } from '../infrastructure/user.model';

export function toUserView(user: UserDocument): UserView {
  const preferences = {
    notifications: {
      messages: user.preferences?.notifications.messages ?? true,
      teamActivity: user.preferences?.notifications.teamActivity ?? true,
      projectActivity: user.preferences?.notifications.projectActivity ?? true,
      communityActivity: user.preferences?.notifications.communityActivity ?? true,
      eventUpdates: user.preferences?.notifications.eventUpdates ?? true,
      socialInteractions: user.preferences?.notifications.socialInteractions ?? true,
    },
    privacy: {
      profileDiscoverable: user.preferences?.privacy.profileDiscoverable ?? true,
      showInRecommendations: user.preferences?.privacy.showInRecommendations ?? true,
    },
  };
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    ...(user.bio ? { bio: user.bio } : {}),
    ...(user.college ? { college: user.college } : {}),
    ...(user.department ? { department: user.department } : {}),
    ...(user.course ? { course: user.course } : {}),
    ...(user.graduationYear ? { graduationYear: user.graduationYear } : {}),
    skills: user.skills,
    interests: user.interests,
    goals: user.goals,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    accountState: user.accountState,
    verificationStatus: user.verificationStatus,
    roles: user.roles,
    preferences,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
