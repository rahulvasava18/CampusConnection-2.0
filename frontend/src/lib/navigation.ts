import {
  CalendarDays,
  BadgeCheck,
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
  | 'clubs'
  | 'clubCreate'
  | 'clubDetail'
  | 'clubManage'
  | 'clubEventCreate'
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
  | 'eventDetail'
  | 'admin'
  | 'adminUsers'
  | 'adminUserDetail'
  | 'adminAnalytics'
  | 'adminReports'
  | 'adminReportDetail'
  | 'adminPosts'
  | 'adminComments'
  | 'adminTeams'
  | 'adminCommunities'
  | 'adminClubs'
  | 'adminEvents'
  | 'adminModeration'
  | 'adminAuditLogs'
  | 'adminNotifications'
  | 'adminSettings'
  | 'adminLogin';

export type NavItem = {
  id: RouteId;
  label: string;
  icon: LucideIcon;
};

export const routePaths: Partial<Record<RouteId, string>> = {
  home: '/home',
  search: '/search',
  communities: '/communities',
  clubs: '/clubs',
  clubCreate: '/clubs/create',
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
  admin: '/admin',
  adminUsers: '/admin/users',
  adminAnalytics: '/admin/analytics',
  adminReports: '/admin/reports',
  adminPosts: '/admin/posts',
  adminComments: '/admin/comments',
  adminTeams: '/admin/teams',
  adminCommunities: '/admin/communities',
  adminClubs: '/admin/clubs',
  adminEvents: '/admin/events',
  adminModeration: '/admin/moderation',
  adminAuditLogs: '/admin/audit-logs',
  adminNotifications: '/admin/notifications',
  adminSettings: '/admin/settings',
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
  { id: 'clubs', label: 'Clubs', icon: BadgeCheck },
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
  if (cleanPath === '/clubs/create') return 'clubCreate';
  if (/^\/clubs\/[^/]+\/events\/create$/.test(cleanPath)) return 'clubEventCreate';
  if (/^\/clubs\/[^/]+\/manage$/.test(cleanPath)) return 'clubManage';
  if (/^\/clubs\/[^/]+$/.test(cleanPath)) return 'clubDetail';
  if (cleanPath === '/teams/create') return 'teamCreate';
  if (cleanPath === '/projects/create') return 'projectCreate';
  if (/^\/communities\/[^/]+\/discussions\/create$/.test(cleanPath)) return 'discussionCreate';
  if (/^\/discussions\/[^/]+$/.test(cleanPath)) return 'discussionDetail';
  if (/^\/communities\/[^/]+$/.test(cleanPath)) return 'communityDetail';
  if (/^\/teams\/[^/]+$/.test(cleanPath)) return 'teamDetail';
  if (/^\/projects\/[^/]+$/.test(cleanPath)) return 'projectDetail';
  if (/^\/events\/[^/]+$/.test(cleanPath)) return 'eventDetail';
  if (cleanPath === '/admin/login') return 'adminLogin';
  if (cleanPath === '/admin/users') return 'adminUsers';
  if (/^\/admin\/users\/[^/]+$/.test(cleanPath)) return 'adminUserDetail';
  if (/^\/admin\/reports\/[^/]+$/.test(cleanPath)) return 'adminReportDetail';
  if (cleanPath === '/admin/analytics') return 'adminAnalytics';
  if (cleanPath === '/admin/reports') return 'adminReports';
  if (cleanPath === '/admin/posts') return 'adminPosts';
  if (cleanPath === '/admin/comments') return 'adminComments';
  if (cleanPath === '/admin/teams') return 'adminTeams';
  if (cleanPath === '/admin/communities') return 'adminCommunities';
  if (cleanPath === '/admin/clubs') return 'adminClubs';
  if (cleanPath === '/admin/events') return 'adminEvents';
  if (cleanPath === '/admin/moderation') return 'adminModeration';
  if (cleanPath === '/admin/audit-logs') return 'adminAuditLogs';
  if (cleanPath === '/admin/notifications') return 'adminNotifications';
  if (cleanPath === '/admin/settings') return 'adminSettings';
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) return 'admin';
  const match = (Object.entries(routePaths) as Array<[RouteId, string]>).find(
    ([, path]) => path === cleanPath,
  );
  return match?.[0] ?? 'home';
}
