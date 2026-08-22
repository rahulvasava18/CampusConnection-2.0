import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchResult } from '@campusconnection/shared';
import { CommunityHeader } from './components/CommunityHeader';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  TextareaField,
} from '../../components/ui';
import { Post } from '../post/Post';
import { PostCard } from '../../features/social/components/PostCard';
import { CommunicationHome } from '../../features/communication/CommunicationHome';
import { useAuthStore } from '../../features/auth/auth.store';
import { getCommunityPosts } from '../../features/social/social.api';
import {
  apiErrorMessage,
  collectionItems,
  isRestrictedApiError,
  paginatedItems,
} from '../../lib/api-state';
import {
  banCommunityMember,
  createCommunityReport,
  deleteCommunity,
  getCommunity,
  getCommunityBans,
  getCommunityMembers,
  getCommunityReports,
  getJoinRequests,
  inviteCommunityMember,
  joinCommunity,
  leaveCommunity,
  reviewCommunityReport,
  reviewJoinRequest,
  transferCommunityOwnership,
  unbanCommunityMember,
  updateCommunity,
  updateCommunityMember,
} from '../../features/community/community.api';
import { search } from '../../features/discovery/discovery.api';
import { ApiRequestError } from '../../lib/api-state';
import { AdminReportDialog } from '../admin/AdminReportDialog';

type CommunityTab = 'posts' | 'chat' | 'members' | 'about' | 'manage';

export function CommunityDetail({
  communityId,
  onNavigate,
}: {
  communityId: string;
  onNavigate: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [tab, setTab] = useState<CommunityTab>('posts');
  const [inviteSearch, setInviteSearch] = useState('');
  const [selectedInvitee, setSelectedInvitee] = useState<SearchResult | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [centralReportOpen, setCentralReportOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editRules, setEditRules] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const community = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => getCommunity(communityId),
  });
  const members = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => getCommunityMembers(communityId),
    enabled: Boolean(community.data?.isMember),
  });
  const posts = useInfiniteQuery({
    queryKey: ['community-posts', communityId],
    queryFn: ({ pageParam }) => getCommunityPosts(communityId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
    enabled: Boolean(community.data?.isMember),
  });
  const requests = useQuery({
    queryKey: ['community-requests', communityId],
    queryFn: () => getJoinRequests(communityId),
    enabled: tab === 'manage',
  });
  const bans = useQuery({
    queryKey: ['community-bans', communityId],
    queryFn: () => getCommunityBans(communityId),
    enabled: tab === 'manage',
  });
  const reports = useQuery({
    queryKey: ['community-reports', communityId],
    queryFn: () => getCommunityReports(communityId),
    enabled: tab === 'manage',
  });
  const inviteCandidates = useQuery({
    queryKey: ['community-invite-search', inviteSearch.trim()],
    queryFn: () => search(inviteSearch.trim(), 'people'),
    enabled:
      Boolean(community.data?.isMember) &&
      inviteSearch.trim().length >= 2 &&
      selectedInvitee === null,
  });
  useEffect(() => {
    if (!community.data) return;
    setEditName(community.data.name);
    setEditDescription(community.data.description);
    setEditCategory(community.data.category);
    setEditTags(community.data.tags.join(', '));
    setEditRules(community.data.rules.join('\n'));
    setEditAvatarUrl(community.data.avatarUrl ?? '');
    setEditBannerUrl(community.data.bannerUrl ?? '');
  }, [community.data]);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['community', communityId] });
    void queryClient.invalidateQueries({ queryKey: ['community-members', communityId] });
    void queryClient.invalidateQueries({ queryKey: ['community-posts', communityId] });
    void queryClient.invalidateQueries({ queryKey: ['community-requests', communityId] });
    void queryClient.invalidateQueries({ queryKey: ['community-bans', communityId] });
    void queryClient.invalidateQueries({ queryKey: ['community-reports', communityId] });
  };
  const membership = useMutation({
    mutationFn: async (joined: boolean) => {
      if (joined) await leaveCommunity(communityId);
      else await joinCommunity(communityId);
    },
    onSuccess: invalidate,
  });
  const invite = useMutation({
    mutationFn: (inviteeId: string) => inviteCommunityMember(communityId, inviteeId),
    onSuccess: () => {
      setInviteSearch('');
      setSelectedInvitee(null);
      setInviteMessage('Invitation sent successfully.');
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['community-invitations'] });
    },
  });
  const manageMember = useMutation({
    mutationFn: ({
      userId,
      role,
      status,
    }: {
      userId: string;
      role?: 'ADMIN' | 'MODERATOR' | 'MEMBER';
      status?: 'LEFT';
    }) =>
      updateCommunityMember(communityId, userId, {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      }),
    onSuccess: invalidate,
  });
  const ban = useMutation({
    mutationFn: (userId: string) =>
      banCommunityMember(communityId, userId, { reason: 'Community moderation action' }),
    onSuccess: invalidate,
  });
  const unban = useMutation({
    mutationFn: (userId: string) => unbanCommunityMember(communityId, userId),
    onSuccess: invalidate,
  });
  const reviewRequest = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewJoinRequest(communityId, id, approve),
    onSuccess: invalidate,
  });
  const reviewReport = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RESOLVED' | 'DISMISSED' }) =>
      reviewCommunityReport(communityId, id, { status }),
    onSuccess: invalidate,
  });
  const report = useMutation({
    mutationFn: ({
      targetType,
      targetId,
      reason,
    }: {
      targetType: 'POST' | 'COMMENT' | 'MEMBER';
      targetId: string;
      reason: string;
    }) => createCommunityReport(communityId, { targetType, targetId, reason }),
    onSuccess: () => setReportMessage('Report submitted for moderator review.'),
  });
  const edit = useMutation({
    mutationFn: () =>
      updateCommunity(communityId, {
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory.trim(),
        tags: editTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        rules: editRules
          .split('\n')
          .map((rule) => rule.trim())
          .filter(Boolean),
        ...(editAvatarUrl.trim() ? { avatarUrl: editAvatarUrl.trim() } : {}),
        ...(editBannerUrl.trim() ? { bannerUrl: editBannerUrl.trim() } : {}),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => deleteCommunity(communityId),
    onSuccess: () => onNavigate('/communities'),
  });
  const transfer = useMutation({
    mutationFn: () => transferCommunityOwnership(communityId, transferUserId.trim()),
    onSuccess: invalidate,
  });

  if (community.isLoading) return <LoadingState label="Opening community" />;
  if (community.error || !community.data)
    return <ErrorState message={apiErrorMessage(community.error, 'Community not found.')} />;
  const item = community.data;
  const memberItems = collectionItems(members.data);
  const visibleMemberItems = memberItems.filter((member) =>
    `${member.user.displayName} ${member.user.username}`
      .toLowerCase()
      .includes(memberSearch.trim().toLowerCase()),
  );
  const postItems = paginatedItems(posts.data?.pages);
  const canManage = ['OWNER', 'ADMIN', 'MODERATOR'].includes(item.membershipRole ?? '');
  const canAdmin = ['OWNER', 'ADMIN'].includes(item.membershipRole ?? '');
  const inviteResults = collectionItems(inviteCandidates.data);
  const inviteErrorMessage =
    invite.error instanceof ApiRequestError
      ? {
          INVITATION_EXISTS: 'This member already has a pending invitation.',
          MEMBERSHIP_EXISTS: 'This member is already part of the community.',
          RESOURCE_NOT_FOUND: 'That member could not be found or is unavailable.',
          FORBIDDEN: 'You are not authorized to invite members to this community.',
        }[invite.error.code] ?? invite.error.message
      : invite.error
        ? apiErrorMessage(invite.error, 'The invitation could not be sent.')
        : null;

  const reportContent = (targetType: 'POST' | 'COMMENT' | 'MEMBER', targetId: string) => {
    const reason = window.prompt(`Why are you reporting this ${targetType.toLowerCase()}?`);
    if (!reason?.trim()) return;
    report.mutate({ targetType, targetId, reason: reason.trim() });
  };

  return (
    <div className="page-theme page-theme-communities space-y-5">
      <CommunityHeader
        community={item}
        onBack={() => onNavigate('/communities')}
        onJoin={() => membership.mutate(false)}
        onLeave={() => membership.mutate(true)}
        onCreateDiscussion={() => setTab('posts')}
        onInvite={canAdmin ? () => setTab('manage') : undefined}
        onManage={canManage ? () => setTab('manage') : undefined}
        onReport={() => setCentralReportOpen(true)}
        busy={membership.isPending}
      />
      <AdminReportDialog open={centralReportOpen} targetType="COMMUNITY" targetId={communityId} onClose={() => setCentralReportOpen(false)} />
      {membership.error ||
      invite.error ||
      manageMember.error ||
      ban.error ||
      unban.error ||
      reviewRequest.error ||
      reviewReport.error ||
      report.error ||
      edit.error ||
      remove.error ||
      transfer.error ? (
        <ErrorState
          message={apiErrorMessage(
            membership.error ??
              invite.error ??
              manageMember.error ??
              ban.error ??
              unban.error ??
              reviewRequest.error ??
              reviewReport.error ??
              report.error ??
              edit.error ??
              remove.error ??
              transfer.error,
            'Community action could not be completed.',
          )}
        />
      ) : null}
      {reportMessage ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {reportMessage}
        </p>
      ) : null}
      <div
        className="flex gap-2 overflow-x-auto border-b border-line pb-2"
        role="tablist"
        aria-label="Community sections"
      >
        {(
          ['posts', 'chat', 'members', 'about', ...(canManage ? ['manage'] : [])] as CommunityTab[]
        ).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={tab === entry}
            onClick={() => setTab(entry)}
            className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${tab === entry ? 'bg-brand-50 text-brand-700' : 'text-muted hover:text-brand-700'}`}
          >
            {entry}
          </button>
        ))}
      </div>
      {tab === 'posts' ? (
        <section className="space-y-5">
          {item.isMember ? (
            <Post
              communityId={communityId}
              communityName={item.name}
              onNavigate={onNavigate}
              onPublished={() =>
                void queryClient.invalidateQueries({ queryKey: ['community-posts', communityId] })
              }
            />
          ) : (
            <EmptyState
              title="Join to participate"
              description="Join this community to view and create community posts."
            />
          )}
          {posts.isLoading ? <LoadingState label="Loading community posts" /> : null}
          {isRestrictedApiError(posts.error) ? (
            <EmptyState
              title="Membership required"
              description="Join the community to access its posts."
            />
          ) : posts.error ? (
            <ErrorState
              message={apiErrorMessage(posts.error, 'Community posts could not be loaded.')}
              onRetry={() => void posts.refetch()}
            />
          ) : null}
          {!posts.isLoading && !posts.error && !postItems.length && item.isMember ? (
            <EmptyState
              title="No community posts yet"
              description="Start the first conversation for this community."
            />
          ) : null}
          <div className="grid gap-4">
            {postItems.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onNavigate={onNavigate}
                onReport={() => reportContent('POST', post.id)}
                onReportComment={(commentId) => reportContent('COMMENT', commentId)}
              />
            ))}
          </div>
          {posts.hasNextPage ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void posts.fetchNextPage()}
              disabled={posts.isFetchingNextPage}
            >
              {posts.isFetchingNextPage ? 'Loading…' : 'Load more posts'}
            </Button>
          ) : null}
        </section>
      ) : null}
      {tab === 'chat' ? <CommunicationHome communityId={communityId} /> : null}
      {tab === 'members' ? (
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">
            Members · {item.memberCount ?? memberItems.length}
          </h2>
          <Field
            className="mt-4"
            label="Search members"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
            placeholder="Search by name or username"
          />
          {members.isLoading ? <LoadingState label="Loading members" /> : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {visibleMemberItems.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <Avatar name={member.user.displayName} src={member.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{member.user.displayName}</p>
                  <p className="text-xs text-muted">
                    @{member.user.username} · {member.role}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => reportContent('MEMBER', member.userId)}
                >
                  Report
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {tab === 'about' ? (
        <Card className="space-y-5 p-5">
          <div>
            <h2 className="type-display text-xl font-bold text-ink">About {item.name}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{item.description}</p>
          </div>
          <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.category}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Visibility</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.privacy}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Members</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.memberCount ?? 0}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Community rules</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {item.rules.length ? (
                item.rules.map((rule) => <li key={rule}>{rule}</li>)
              ) : (
                <li>No rules have been published yet.</li>
              )}
            </ol>
          </div>
        </Card>
      ) : null}
      {tab === 'manage' ? (
        <section className="grid gap-5 lg:grid-cols-2">
          {canAdmin ? (
            <Card className="p-5">
              <h2 className="type-display text-lg font-bold text-ink">Invite members</h2>
              <div className="mt-4">
                <Field
                  label="Search member by username or name"
                  value={inviteSearch}
                  onChange={(event) => {
                    setInviteSearch(event.target.value);
                    setSelectedInvitee(null);
                    setInviteMessage(null);
                    invite.reset();
                  }}
                  placeholder="Search member by username or name"
                  hint={
                    inviteSearch.trim().length < 2
                      ? 'Enter at least 2 characters to search.'
                      : undefined
                  }
                />
                {inviteSearch.trim().length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Search for a member to send an invitation.</p>
                ) : null}
                {inviteCandidates.isLoading ? (
                  <LoadingState label="Searching members" />
                ) : null}
                {inviteCandidates.error ? (
                  <p className="mt-3 text-sm font-semibold text-red-600">
                    {apiErrorMessage(inviteCandidates.error, 'Member search is unavailable.')}
                  </p>
                ) : null}
                {!inviteCandidates.isLoading &&
                !inviteCandidates.error &&
                inviteSearch.trim().length >= 2 &&
                !selectedInvitee &&
                !inviteResults.length ? (
                  <p className="mt-3 text-sm text-muted">No matching members found.</p>
                ) : null}
                {selectedInvitee ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <Avatar
                      name={selectedInvitee.title}
                      src={selectedInvitee.imageUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {selectedInvitee.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        @{typeof selectedInvitee.metadata.username === 'string'
                          ? selectedInvitee.metadata.username
                          : 'member'}
                      </p>
                    </div>
                    {selectedInvitee.id === currentUserId ? (
                      <p className="w-full text-sm font-semibold text-amber-700">
                        You cannot invite yourself.
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => invite.mutate(selectedInvitee.id)}
                        disabled={invite.isPending}
                      >
                        {invite.isPending ? 'Inviting…' : 'Invite'}
                      </Button>
                    )}
                  </div>
                ) : null}
                {!selectedInvitee && inviteResults.length ? (
                  <div className="mt-3 space-y-2">
                    {inviteResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50"
                        onClick={() => {
                          setSelectedInvitee(result);
                          setInviteMessage(null);
                          invite.reset();
                        }}
                      >
                        <Avatar name={result.title} src={result.imageUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {result.title}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            @{typeof result.metadata.username === 'string'
                              ? result.metadata.username
                              : 'member'}
                          </span>
                        </span>
                        <span className="text-xs font-semibold text-brand-700">Select</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {inviteMessage ? (
                  <p className="mt-3 text-sm font-semibold text-emerald-700">{inviteMessage}</p>
                ) : null}
                {inviteErrorMessage ? (
                  <p className="mt-3 text-sm font-semibold text-red-600">{inviteErrorMessage}</p>
                ) : null}
              </div>
            </Card>
          ) : null}
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Join requests</h2>
            {requests.isLoading ? <LoadingState label="Loading requests" /> : null}
            <div className="mt-3 space-y-2">
              {collectionItems(requests.data).map((request) => (
                <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-ink">{request.userId}</p>
                  <p className="mt-1 text-xs text-muted">
                    {request.message ?? 'Requested to join'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => reviewRequest.mutate({ id: request.id, approve: true })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => reviewRequest.mutate({ id: request.id, approve: false })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Member management</h2>
            <Field
              className="mt-4"
              label="Search members"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Search by name or username"
            />
            <div className="mt-3 space-y-2">
              {visibleMemberItems.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"
                >
                  <Avatar name={member.user.displayName} size="sm" />
                  <span className="mr-auto text-sm font-semibold text-ink">
                    {member.user.displayName}
                  </span>
                  {member.role !== 'OWNER' ? (
                    <>
                      <select
                        aria-label={`Role for ${member.user.displayName}`}
                        value={member.role}
                        onChange={(event) =>
                          manageMember.mutate({
                            userId: member.userId,
                            role: event.target.value as 'ADMIN' | 'MODERATOR' | 'MEMBER',
                          })
                        }
                        className="rounded-lg border border-line bg-white px-2 py-2 text-xs"
                      >
                        <option>MEMBER</option>
                        <option>MODERATOR</option>
                        {item.membershipRole === 'OWNER' ? <option>ADMIN</option> : null}
                      </select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => ban.mutate(member.userId)}
                        disabled={member.userId === item.ownerId}
                      >
                        Ban
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            window.confirm(`Remove ${member.user.displayName} from this community?`)
                          )
                            manageMember.mutate({ userId: member.userId, status: 'LEFT' });
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Badge tone="brand">OWNER</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Banned members</h2>
            {bans.isLoading ? <LoadingState label="Loading bans" /> : null}
            <div className="mt-3 space-y-2">
              {collectionItems(bans.data).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
                >
                  <span className="text-sm font-semibold text-ink">{entry.userId}</span>
                  <Button size="sm" variant="secondary" onClick={() => unban.mutate(entry.userId)}>
                    Unban
                  </Button>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h2 className="type-display text-lg font-bold text-ink">Community settings</h2>
            <form
              className="mt-4 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                edit.mutate();
              }}
            >
              <Field
                label="Name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
              <TextareaField
                label="Description"
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
              <Field
                label="Category"
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
              />
              <Field
                label="Tags (comma separated)"
                value={editTags}
                onChange={(event) => setEditTags(event.target.value)}
              />
              <TextareaField
                label="Rules (one per line)"
                value={editRules}
                onChange={(event) => setEditRules(event.target.value)}
              />
              <Field
                label="Avatar image URL"
                value={editAvatarUrl}
                onChange={(event) => setEditAvatarUrl(event.target.value)}
              />
              <Field
                label="Cover image URL"
                value={editBannerUrl}
                onChange={(event) => setEditBannerUrl(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={edit.isPending || !editName.trim() || !editDescription.trim()}
                >
                  Save changes
                </Button>
                {canAdmin ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm('Archive this community?')) remove.mutate();
                    }}
                    disabled={remove.isPending}
                  >
                    Archive community
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
          {canAdmin ? (
            <Card className="p-5">
              <h2 className="type-display text-lg font-bold text-ink">Transfer ownership</h2>
              <p className="mt-1 text-sm text-muted">
                Transfer ownership to an active member. You will remain an administrator.
              </p>
              <div className="mt-4 flex gap-2">
                <Field
                  className="flex-1"
                  label="Active member user ID"
                  value={transferUserId}
                  onChange={(event) => setTransferUserId(event.target.value)}
                />
                <Button
                  className="self-end"
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm('Transfer ownership to this member?')) transfer.mutate();
                  }}
                  disabled={!transferUserId.trim() || transfer.isPending}
                >
                  Transfer
                </Button>
              </div>
            </Card>
          ) : null}
          <Card className="p-5 lg:col-span-2">
            <h2 className="type-display text-lg font-bold text-ink">Moderation reports</h2>
            {reports.isLoading ? <LoadingState label="Loading reports" /> : null}
            <div className="mt-3 space-y-2">
              {collectionItems(reports.data).map((report) => (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <div className="mr-auto">
                    <p className="text-sm font-semibold text-ink">
                      {report.targetType} · {report.targetId}
                    </p>
                    <p className="text-xs text-muted">
                      {report.reason} · {report.status}
                    </p>
                  </div>
                  {report.status === 'OPEN' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => reviewReport.mutate({ id: report.id, status: 'RESOLVED' })}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => reviewReport.mutate({ id: report.id, status: 'DISMISSED' })}
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
