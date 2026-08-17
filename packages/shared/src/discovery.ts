export const SEARCH_ENTITY_TYPES = ['people', 'communities', 'teams', 'projects'] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];
export type SearchResultType = 'person' | 'community' | 'team' | 'project';

export interface SearchFilters {
  college?: string;
  course?: string;
  communityId?: string;
  projectId?: string;
  skill?: string;
  category?: string;
  teamStatus?: 'RECRUITING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  projectStatus?: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  visibility?: 'PUBLIC' | 'CAMPUS' | 'PRIVATE' | 'CONNECTIONS';
  verifiedOnly?: boolean;
}

export interface SearchHighlight {
  field: string;
  value: string;
}

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  snippet?: string;
  imageUrl?: string;
  metadata: Record<string, string | number | boolean | string[] | undefined>;
  score?: number;
  highlights?: SearchHighlight[];
}

export interface MatchReason {
  code: string;
  message: string;
  matched: string[];
}

export interface TeamMatchResult {
  teamId: string;
  matchScore: number;
  reasons: MatchReason[];
  coveredRequiredSkills: string[];
  coveredPreferredSkills: string[];
}

export interface TeamRequirementView {
  id: string;
  teamId: string;
  roleName: string;
  skills: string[];
  interests: string[];
  experienceLevel?: string;
  slots: number;
  filledSlots: number;
  description: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}
