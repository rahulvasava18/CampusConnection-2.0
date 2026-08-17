import type {
  RecommendationCollection,
  RecommendationItem,
  RecommendationType,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

const paths: Record<RecommendationType, string> = {
  PEOPLE: 'people',
  TEAMS: 'teams',
  PROJECTS: 'projects',
  COMMUNITIES: 'communities',
};
export function getRecommendations(type: RecommendationType, cursor?: string) {
  const params = new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) });
  return apiRequest<RecommendationCollection<RecommendationItem>>(
    `/recommendations/${paths[type]}?${params.toString()}`,
  );
}
export function sendRecommendationFeedback(
  recommendationId: string,
  recommendationType: RecommendationType,
  feedback: 'DISMISS' | 'NOT_RELEVANT' | 'HELPFUL',
) {
  return apiRequest<void>(`/recommendations/${recommendationId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ recommendationType, feedback }),
  });
}

export function refreshRecommendations() {
  return apiRequest<void>('/recommendations/refresh', { method: 'POST' });
}
