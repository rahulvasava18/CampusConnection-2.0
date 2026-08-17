export const POST_TYPES = [
  'GENERAL',
  'DISCUSSION',
  'QUESTION',
  'IDEA',
  'OPPORTUNITY',
  'ANNOUNCEMENT',
] as const;
export type PostType = (typeof POST_TYPES)[number];
export const DEFAULT_POST_TYPE: PostType = 'GENERAL';

export const VISIBILITIES = ['PUBLIC', 'CAMPUS', 'CONNECTIONS', 'COMMUNITY'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export type PostStatus = 'ACTIVE' | 'DELETED';
export type ReactionType = 'LIKE';
export type ReactionTargetType = 'POST' | 'COMMENT';
export type ConnectionState = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REMOVED';

export interface SocialAuthorView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SocialMediaView {
  id: string;
  url: string;
  type: string;
  width?: number;
  height?: number;
  bytes?: number;
}

import type { FeedRankingMetadata } from './recommendations';

export interface SocialPostView {
  id: string;
  author: SocialAuthorView;
  type: PostType;
  content: string;
  tags: string[];
  communityId?: string;
  link?: string;
  visibility: Visibility;
  mediaAssetIds: string[];
  media: SocialMediaView[];
  status: PostStatus;
  reactionCount: number;
  commentCount: number;
  viewerHasReacted: boolean;
  createdAt: string;
  updatedAt: string;
  ranking?: FeedRankingMetadata;
}

export interface SocialCommentView {
  id: string;
  postId: string;
  author: SocialAuthorView;
  content: string;
  parentCommentId?: string;
  reactionCount: number;
  viewerHasReacted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionView {
  id: string;
  userId: string;
  state: ConnectionState;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}
