import type {
  ApiCollection,
  CommunityMemberView,
  CommunityView,
  DiscussionView,
  ReplyView,
} from '@campusconnection/shared';

export type { CommunityMemberView, CommunityView, DiscussionView, ReplyView };
export type CommunityCollection = ApiCollection<CommunityView>;
export type DiscussionCollection = ApiCollection<DiscussionView>;
export type ReplyCollection = ApiCollection<ReplyView>;
