import type { ApiCollection } from './api';

export const RECOMMENDATION_TYPES = ['PEOPLE', 'TEAMS', 'PROJECTS', 'COMMUNITIES'] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_REASON_CODES = [
  'SKILL_MATCH',
  'INTEREST_MATCH',
  'GOAL_MATCH',
  'MUTUAL_CONNECTION',
  'COLLEGE_CONTEXT',
  'COMMUNITY_RELEVANCE',
  'PROJECT_RELEVANCE',
  'TEAM_REQUIREMENT_MATCH',
  'CAPACITY_AVAILABLE',
  'RECENT_ACTIVITY',
  'FRESH_CONTENT',
  'ENGAGEMENT_SIGNAL',
] as const;
export type RecommendationReasonCode = (typeof RECOMMENDATION_REASON_CODES)[number];

export type AlgorithmVersion = 'recommendation-v1';

export interface RecommendationReason {
  code: RecommendationReasonCode;
  message: string;
  matched?: string[];
}

export interface RecommendationTarget {
  id: string;
  type: 'PERSON' | 'TEAM' | 'PROJECT' | 'COMMUNITY';
  title: string;
  description?: string;
  imageUrl?: string;
  metadata: Record<string, unknown>;
}

export interface RecommendationItem {
  id: string;
  targetId: string;
  type: RecommendationType;
  score: number;
  reasons: RecommendationReason[];
  target: RecommendationTarget;
  generatedAt: string;
  algorithmVersion: AlgorithmVersion;
}

export type RecommendationReadinessLevel = 0 | 1 | 2 | 3;

export interface RecommendationReadiness {
  ready: boolean;
  signalCount: number;
  level: RecommendationReadinessLevel;
  meaningfulActivity: boolean;
}

export interface RecommendationCollection<T> extends ApiCollection<T> {
  readiness: RecommendationReadiness;
}

export interface FeedRankingMetadata {
  score: number;
  reasonCodes: RecommendationReasonCode[];
  algorithmVersion: AlgorithmVersion;
}
