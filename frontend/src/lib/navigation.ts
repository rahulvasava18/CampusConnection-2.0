import {
  CalendarDays,
  FolderKanban,
  Home,
  MessageCircle,
  Network,
  PenLine,
  Sparkles,
  Users,
  SearchIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type RouteId =
  | 'home'
  | 'search'
  | 'communities'
  | 'communityCreate'
  | 'communityDetail'
  | 'discussionCreate'
  | 'discussionDetail'
  | 'messages'
  | 'notifications'
  | 'recommendations'
  | 'post'
  | 'teams'
  | 'projects'
  | 'events'
  | 'profile'
  | 'settings'
  | 'resources'
  | 'teamCreate'
  | 'teamDetail'
  | 'projectCreate'
  | 'projectDetail'
  | 'eventCreate'
  | 'eventDetail';

export type NavItem = {
  id: RouteId;
  label: string;
  icon: LucideIcon;
};

export const routePaths: Partial<Record<RouteId, string>> = {
  home: '/home',
  search: '/search',
  communities: '/communities',
  messages: '/messages',
  notifications: '/notifications',
  recommendations: '/for-you',
  post: '/post',
  teams: '/teams',
  projects: '/projects',
  events: '/events',
  profile: '/profile',
  settings: '/settings',
  resources: '/resources',
};

export const primaryNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'post', label: 'Post', icon: PenLine },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'recommendations', label: 'For you', icon: Sparkles },
];

export const workspaceNav: NavItem[] = [
  { id: 'communities', label: 'Communities ', icon: Network },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'events', label: 'Events', icon: CalendarDays },
];

export function routeFromPath(pathname: string): RouteId {
  const cleanPath = pathname.split(/[?#]/, 1)[0] ?? pathname;
  if (/^\/users\/[^/]+\/profile$/.test(cleanPath)) return 'profile';
  if (cleanPath === '/hackathons') return 'events';
  if (cleanPath === '/collaboration') return 'communities';
  if (cleanPath === '/communities/create') return 'communityCreate';
  if (cleanPath === '/teams/create') return 'teamCreate';
  if (cleanPath === '/projects/create') return 'projectCreate';
  if (cleanPath === '/events/create') return 'eventCreate';
  if (/^\/communities\/[^/]+\/discussions\/create$/.test(cleanPath)) return 'discussionCreate';
  if (/^\/discussions\/[^/]+$/.test(cleanPath)) return 'discussionDetail';
  if (/^\/communities\/[^/]+$/.test(cleanPath)) return 'communityDetail';
  if (/^\/teams\/[^/]+$/.test(cleanPath)) return 'teamDetail';
  if (/^\/projects\/[^/]+$/.test(cleanPath)) return 'projectDetail';
  if (/^\/events\/[^/]+$/.test(cleanPath)) return 'eventDetail';
  const match = (Object.entries(routePaths) as Array<[RouteId, string]>).find(
    ([, path]) => path === cleanPath,
  );
  return match?.[0] ?? 'home';
}
