import type {
  RecommendationReadiness,
  RecommendationReadinessLevel,
} from '@campusconnection/shared';
import type { RecommendationProfile } from './candidate-generators';

export interface RecommendationActivity {
  acceptedConnectionCount: number;
  communityMembershipCount: number;
  teamMembershipCount: number;
  projectMembershipCount: number;
  authoredPostCount: number;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getRecommendationReadiness(
  profile: Pick<
    RecommendationProfile,
    'bio' | 'college' | 'course' | 'skills' | 'interests' | 'goals'
  >,
  activity: RecommendationActivity,
): RecommendationReadiness {
  const profileSignalCount =
    profile.skills.length +
    profile.interests.length +
    profile.goals.length +
    Number(hasText(profile.bio)) +
    Number(hasText(profile.college)) +
    Number(hasText(profile.course));
  const meaningfulActivity =
    activity.acceptedConnectionCount > 0 ||
    activity.communityMembershipCount > 0 ||
    activity.teamMembershipCount > 0 ||
    activity.projectMembershipCount > 0 ||
    activity.authoredPostCount > 0;
  const activitySignalCount =
    Number(activity.acceptedConnectionCount > 0) +
    Number(activity.communityMembershipCount > 0) +
    Number(activity.teamMembershipCount > 0) +
    Number(activity.projectMembershipCount > 0) +
    Number(activity.authoredPostCount > 0);
  const signalCount = profileSignalCount + activitySignalCount;
  const level: RecommendationReadinessLevel = meaningfulActivity
    ? 3
    : signalCount >= 6
      ? 2
      : signalCount >= 3
        ? 1
        : 0;
  return {
    ready: signalCount >= 3 || meaningfulActivity,
    signalCount,
    level,
    meaningfulActivity,
  };
}
