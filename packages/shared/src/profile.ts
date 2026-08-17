import type { ApiCollection } from './api';
import type {
  CommunityPrivacy,
  EventMode,
  EventStatus,
  ProjectStatus,
  TeamStatus,
} from './collaboration';
import type { SocialPostView } from './social';

export interface ProfileIdentityView {
  id: string;
  username: string;
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
  joinedAt: string;
}

export interface ProfileProjectView {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  role: 'OWNER' | 'COLLABORATOR';
  technologies: string[];
  progressPercent: number;
  coverImageUrl?: string;
}

export interface ProfileTeamView {
  id: string;
  name: string;
  description: string;
  status: TeamStatus;
  role: 'OWNER' | 'CO_LEAD' | 'MEMBER';
  memberCount?: number;
  avatarUrl?: string;
}

export interface ProfileCommunityView {
  id: string;
  name: string;
  description: string;
  category: string;
  privacy: CommunityPrivacy;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  memberCount?: number;
  avatarUrl?: string;
}

export interface ProfileEventView {
  id: string;
  title: string;
  category: string;
  status: EventStatus;
  mode: EventMode;
  startAt: string;
  endAt: string;
  visibility: 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
  participation: 'ORGANIZER' | 'REGISTERED' | 'ATTENDED';
  coverImageUrl?: string;
}

export interface ProfileStats {
  posts: number;
  projects: number;
  teams: number;
  communities: number;
  events: number;
}

export interface ProfileView {
  user: ProfileIdentityView;
  stats: ProfileStats;
  projects: ProfileProjectView[];
  teams: ProfileTeamView[];
  communities: ProfileCommunityView[];
  events: ProfileEventView[];
  posts: ApiCollection<SocialPostView>;
  isOwnProfile: boolean;
}
