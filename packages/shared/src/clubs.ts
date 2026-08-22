import type { CollaborationUserView } from './collaboration';

export type ClubStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ARCHIVED';
export type ClubPrivacy = 'PUBLIC' | 'PRIVATE';
export type ClubMembershipRole = 'OWNER' | 'SECRETARY' | 'MEMBER';
export type ClubMembershipStatus = 'ACTIVE' | 'LEFT' | 'REMOVED';
export type ClubJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ClubInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface ClubSummaryView {
  id: string;
  name: string;
  slug: string;
  category: string;
  privacy: ClubPrivacy;
  status: ClubStatus;
  logoUrl?: string;
  bannerUrl?: string;
}

export interface ClubView extends ClubSummaryView {
  description: string;
  shortDescription?: string;
  tags: string[];
  collegeId?: string;
  contactEmail: string;
  website?: string;
  memberCount: number;
  secretaryCount: number;
  eventCount: number;
  ownerId: string;
  isMember?: boolean;
  membershipRole?: ClubMembershipRole;
  membershipStatus?: ClubMembershipStatus;
  joinRequestStatus?: ClubJoinRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClubMembershipView {
  id: string;
  clubId: string;
  userId: string;
  role: ClubMembershipRole;
  status: ClubMembershipStatus;
  user?: CollaborationUserView;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClubJoinRequestView {
  id: string;
  clubId: string;
  userId: string;
  status: ClubJoinRequestStatus;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClubInvitationView {
  id: string;
  clubId: string;
  inviterId: string;
  inviteeId: string;
  status: ClubInvitationStatus;
  club?: ClubSummaryView;
  createdAt: string;
  updatedAt: string;
}
