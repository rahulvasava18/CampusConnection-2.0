import type { ClubSummaryView } from './clubs';

export type CommunityPrivacy = 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
export type CommunityStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
export type CommunityMemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type CommunityMemberStatus = 'ACTIVE' | 'PENDING' | 'BANNED' | 'LEFT';
export type CommunityJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CommunityInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type CommunityBanStatus = 'ACTIVE' | 'REVOKED';
export type CommunityReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
export type DiscussionType = 'QUESTION' | 'DISCUSSION' | 'RESOURCE';
export type DiscussionStatus = 'ACTIVE' | 'DELETED';
export type ReplyStatus = 'ACTIVE' | 'DELETED';
export type TeamStatus = 'RECRUITING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TeamVisibility = 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
export type TeamMemberRole = 'OWNER' | 'CO_LEAD' | 'MEMBER';
export type TeamMemberStatus = 'PENDING' | 'ACTIVE' | 'LEFT';
export type TeamInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type ProjectVisibility = 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
export type ProjectMemberRole = 'OWNER' | 'COLLABORATOR';
export type ProjectMemberStatus = 'PENDING' | 'ACTIVE' | 'LEFT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type MilestoneStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
export type ProjectJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProjectInvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type ProjectResourceType = 'REPOSITORY' | 'DEMO' | 'DOCUMENTATION' | 'DESIGN' | 'OTHER';
export type EventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type EventVisibility = 'PUBLIC' | 'CAMPUS' | 'PRIVATE';
export type EventMode = 'OFFLINE' | 'ONLINE' | 'HYBRID';
export type EventRegistrationStatus = 'REGISTERED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export interface CollaborationUserView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}
export interface CommunityView {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  rules: string[];
  avatarUrl?: string;
  bannerUrl?: string;
  collegeId?: string;
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  ownerId: string;
  memberCount?: number;
  isMember?: boolean;
  membershipStatus?: CommunityMemberStatus;
  membershipRole?: CommunityMemberRole;
  createdAt: string;
  updatedAt: string;
}
export interface CommunityJoinRequestView {
  id: string;
  communityId: string;
  userId: string;
  status: CommunityJoinRequestStatus;
  message?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: CollaborationUserView;
}
export interface CommunityInvitationView {
  id: string;
  communityId: string;
  inviterId: string;
  inviteeId: string;
  status: CommunityInvitationStatus;
  createdAt: string;
  updatedAt: string;
  community?: Pick<CommunityView, 'id' | 'name' | 'slug' | 'avatarUrl'>;
}
export interface CommunityBanView {
  id: string;
  communityId: string;
  userId: string;
  bannedBy: string;
  reason?: string;
  expiresAt?: string;
  status: CommunityBanStatus;
  createdAt: string;
  user?: CollaborationUserView;
}
export interface CommunityReportView {
  id: string;
  communityId: string;
  reporterId: string;
  targetType: 'POST' | 'COMMENT' | 'MEMBER';
  targetId: string;
  reason: string;
  status: CommunityReportStatus;
  reviewedBy?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}
export interface CommunityMemberView extends CommunityMembershipView {
  user: CollaborationUserView;
}
export interface DiscussionView {
  id: string;
  communityId: string;
  author: CollaborationUserView;
  title: string;
  content: string;
  type: DiscussionType;
  tags: string[];
  replyCount: number;
  status: DiscussionStatus;
  createdAt: string;
  updatedAt: string;
}
export interface ReplyView {
  id: string;
  discussionId: string;
  author: CollaborationUserView;
  content: string;
  status: ReplyStatus;
  createdAt: string;
  updatedAt: string;
}
export interface CommunityMembershipView {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  status: CommunityMemberStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface TeamView {
  id: string;
  name: string;
  description: string;
  goal?: string;
  category?: string;
  tags?: string[];
  avatarUrl?: string;
  deadline?: string;
  lookingFor?: string[];
  ownerId: string;
  projectId?: string;
  communityId?: string;
  status: TeamStatus;
  maxMembers?: number;
  visibility: TeamVisibility;
  memberCount?: number;
  isMember?: boolean;
  membershipStatus?: TeamMemberStatus;
  membershipRole?: TeamMemberRole;
  createdAt: string;
  updatedAt: string;
}
export interface TeamMembershipView {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: CollaborationUserView;
}
export type TeamJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface TeamJoinRequestView {
  id: string;
  teamId: string;
  userId: string;
  message?: string;
  status: TeamJoinRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface TeamInvitationView {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  status: TeamInvitationStatus;
  expiresAt?: string;
  createdAt: string;
  respondedAt?: string;
  team?: Pick<TeamView, 'id' | 'name' | 'goal'>;
}
export interface TeamInvitationPreviewView {
  invitationId: string;
  status: 'PENDING';
  team: Pick<
    TeamView,
    | 'id'
    | 'name'
    | 'description'
    | 'goal'
    | 'category'
    | 'tags'
    | 'avatarUrl'
    | 'lookingFor'
    | 'ownerId'
    | 'status'
    | 'maxMembers'
    | 'visibility'
    | 'memberCount'
    | 'createdAt'
    | 'updatedAt'
  >;
  owner: CollaborationUserView;
}
export interface ProjectView {
  id: string;
  name: string;
  slug: string;
  description: string;
  objective?: string;
  category?: string;
  tags?: string[];
  ownerTeamId?: string;
  teamId?: string;
  ownerId: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  technologies: string[];
  lookingFor?: string[];
  deadline?: string;
  coverImageUrl?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  showcaseEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  memberCount?: number;
  taskCount?: number;
  completedTaskCount?: number;
  progressPercent?: number;
  isMember?: boolean;
  membershipStatus?: ProjectMemberStatus;
  membershipRole?: ProjectMemberRole;
}
export interface ProjectMembershipView {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: CollaborationUserView;
}
export interface ProjectJoinRequestView {
  id: string;
  projectId: string;
  userId: string;
  message?: string;
  status: ProjectJoinRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: CollaborationUserView;
}
export interface ProjectInvitationView {
  id: string;
  projectId: string;
  inviterId: string;
  inviteeId: string;
  status: ProjectInvitationStatus;
  createdAt: string;
  respondedAt?: string;
  expiresAt?: string;
  project?: Pick<ProjectView, 'id' | 'name' | 'objective'>;
}
export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  creatorId: string;
  assigneeId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  assignee?: CollaborationUserView;
}
export interface MilestoneView {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  dueDate?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
export interface ProjectResourceView {
  id: string;
  projectId: string;
  title: string;
  url: string;
  type: ProjectResourceType;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectActivityView {
  id: string;
  projectId: string;
  actorId: string;
  type: string;
  message: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface EventView {
  id: string;
  title: string;
  description: string;
  organizerId: string;
  organizer?: CollaborationUserView;
  organizerClub?: ClubSummaryView;
  category: string;
  tags: string[];
  coverImageUrl?: string;
  venue?: string;
  mode: EventMode;
  meetingLink?: string;
  startAt: string;
  endAt: string;
  registrationDeadline?: string;
  capacity?: number;
  registrationCount: number;
  availableSeats?: number;
  visibility: EventVisibility;
  status: EventStatus;
  registrationRequired: boolean;
  rules: string[];
  teamId?: string;
  communityId?: string;
  organizerClubId?: string;
  createdBy?: string;
  registrationUrl?: string;
  isRegistered?: boolean;
  registrationStatus?: EventRegistrationStatus;
  canRegister?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventRegistrationView {
  id: string;
  eventId: string;
  userId: string;
  status: EventRegistrationStatus;
  registeredAt: string;
  cancelledAt?: string;
  user?: CollaborationUserView;
  createdAt: string;
  updatedAt: string;
}
