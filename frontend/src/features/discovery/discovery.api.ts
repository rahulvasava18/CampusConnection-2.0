import type {
  ApiCollection,
  SearchEntityType,
  SearchResult,
  TeamMatchResult,
} from '@campusconnection/shared';
import { apiRequest } from '../auth/auth.api';

export function search(query: string, type?: SearchEntityType, cursor?: string) {
  const params = new URLSearchParams({
    q: query,
    limit: '20',
    ...(type ? { type } : {}),
    ...(cursor ? { cursor } : {}),
  });
  return apiRequest<ApiCollection<SearchResult>>(`/search?${params.toString()}`);
}

export function autocomplete(query: string) {
  return apiRequest<SearchResult[]>(
    `/search/autocomplete?${new URLSearchParams({ q: query }).toString()}`,
  );
}

export function matchTeam(teamId: string) {
  return apiRequest<TeamMatchResult>(`/search/teams/${teamId}/match`);
}
