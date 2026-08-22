import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchResult, TeamInvitationPreviewView } from '@campusconnection/shared';
import { CommunicationHome } from '../../features/communication/CommunicationHome';
import { apiErrorMessage, collectionItems, isRestrictedApiError } from '../../lib/api-state';
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
import {
  archiveTeam,
  completeTeam,
  getTeam,
  getTeamInvitationPreview,
  getTeamInvitations,
  getTeamJoinRequests,
  getTeamMembers,
  inviteTeamMember,
  joinTeam,
  leaveTeam,
  removeTeamMember,
  reviewTeamJoinRequest,
  respondToTeamInvitation,
  transferTeamOwnership,
  updateTeam,
  updateTeamMemberRole,
} from '../../features/collaboration/collaboration.api';
import { search } from '../../features/discovery/discovery.api';
import { AdminReportDialog } from '../admin/AdminReportDialog';

type TeamTab = 'overview' | 'chat' | 'members' | 'manage' | 'settings';

function TeamInvitationPreview({
  preview,
  onNavigate,
}: {
  preview: TeamInvitationPreviewView;
  onNavigate: (target: string) => void;
}) {
  const queryClient = useQueryClient();
  const response = useMutation({
    mutationFn: (accepted: boolean) => respondToTeamInvitation(preview.invitationId, accepted),
    onSuccess: (_result, accepted) => {
      void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      onNavigate(accepted ? `/teams/${preview.team.id}` : '/notifications');
    },
  });

  return (
    <section className="page-theme page-theme-teams space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-brand-800 px-5 py-8 text-white sm:px-8">
          <Badge tone="neutral">Team invitation</Badge>
          <h1 className="type-display mt-4 text-3xl font-bold">{preview.team.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
            You have been invited to join this team by {preview.owner.displayName}.
          </p>
        </div>
        <div className="space-y-6 p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <Avatar name={preview.owner.displayName} src={preview.owner.avatarUrl} />
            <div>
              <p className="text-sm font-bold text-ink">{preview.owner.displayName}</p>
              <p className="text-xs text-muted">@{preview.owner.username} · Team owner</p>
            </div>
          </div>
          <p className="text-sm leading-7 text-slate-700">{preview.team.description}</p>
          <div className="grid gap-4 border-y border-line py-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {preview.team.category ?? 'Team'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Members</p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {preview.team.memberCount ?? 0}
                {preview.team.maxMembers ? ` / ${preview.team.maxMembers}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Visibility</p>
              <p className="mt-1 text-sm font-semibold text-ink">{preview.team.visibility}</p>
            </div>
          </div>
          {preview.team.goal ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Goal</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{preview.team.goal}</p>
            </div>
          ) : null}
          {preview.team.lookingFor?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Looking for</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.team.lookingFor.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
              </div>
            </div>
          ) : null}
          {preview.team.tags?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Skills and tags
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.team.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          ) : null}
          {response.error ? (
            <ErrorState
              message={apiErrorMessage(response.error, 'This invitation is no longer available.')}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => response.mutate(true)} disabled={response.isPending}>
              {response.isPending ? 'Processing…' : 'Accept invitation'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => response.mutate(false)}
              disabled={response.isPending}
            >
              Reject
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

export function TeamDetail({
  teamId,
  invitationPreview = false,
  onNavigate,
}: {
  teamId: string;
  invitationPreview?: boolean;
  onNavigate: (target: string) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TeamTab>('overview');
  const [reportOpen, setReportOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [selectedInvitee, setSelectedInvitee] = useState<SearchResult | null>(null);
  const [transferUserId, setTransferUserId] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGoal, setEditGoal] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editLookingFor, setEditLookingFor] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editMaxMembers, setEditMaxMembers] = useState('');
  const [editVisibility, setEditVisibility] = useState('');
  const preview = useQuery({
    queryKey: ['team-invitation-preview', teamId],
    queryFn: () => getTeamInvitationPreview(teamId),
    enabled: invitationPreview,
  });
  const team = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
    enabled: !invitationPreview || Boolean(preview.error),
  });
  const members = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => getTeamMembers(teamId),
    enabled: Boolean(team.data?.isMember),
  });
  const invitePeople = useQuery({
    queryKey: ['team-invite-people', teamId, inviteSearch.trim()],
    queryFn: () => search(inviteSearch.trim(), 'people'),
    enabled: tab === 'manage' && inviteSearch.trim().length >= 2,
  });
  const requests = useQuery({
    queryKey: ['team-requests', teamId],
    queryFn: () => getTeamJoinRequests(teamId),
    enabled:
      tab === 'manage' && ['OWNER', 'CO_LEAD'].includes(team.data?.membershipRole ?? ''),
  });
  const invitations = useQuery({ queryKey: ['team-invitations'], queryFn: getTeamInvitations });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    void queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
    void queryClient.invalidateQueries({ queryKey: ['team-requests', teamId] });
    void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
    void queryClient.invalidateQueries({ queryKey: ['teams'] });
  };
  const membership = useMutation({
    mutationFn: async (leave: boolean) => {
      if (leave) await leaveTeam(teamId);
      else await joinTeam(teamId);
    },
    onSuccess: refresh,
  });
  const invite = useMutation({
    mutationFn: () => {
      if (!selectedInvitee) throw new Error('Select a person to invite.');
      return inviteTeamMember(teamId, selectedInvitee.id);
    },
    onSuccess: () => {
      setInviteSearch('');
      setSelectedInvitee(null);
      refresh();
    },
  });
  const role = useMutation({
    mutationFn: ({ userId, nextRole }: { userId: string; nextRole: 'CO_LEAD' | 'MEMBER' }) =>
      updateTeamMemberRole(teamId, userId, nextRole),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeTeamMember(teamId, userId),
    onSuccess: refresh,
  });
  const requestReview = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) =>
      reviewTeamJoinRequest(teamId, requestId, approve),
    onSuccess: refresh,
  });
  const transfer = useMutation({
    mutationFn: () => transferTeamOwnership(teamId, transferUserId.trim()),
    onSuccess: refresh,
  });
  const edit = useMutation({
    mutationFn: () =>
      updateTeam(teamId, {
        name: editName.trim() || item.name,
        description: editDescription.trim() || item.description,
        goal: editGoal.trim() || item.goal || '',
        category: editCategory.trim() || item.category || 'Project',
        tags: (editTags || item.tags?.join(',') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        lookingFor: (editLookingFor || item.lookingFor?.join(',') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(editDeadline.trim()
          ? { deadline: new Date(`${editDeadline}T23:59:59.000Z`).toISOString() }
          : {}),
        ...(editAvatarUrl.trim() ? { avatarUrl: editAvatarUrl.trim() } : {}),
        ...(editMaxMembers.trim() ? { maxMembers: Number(editMaxMembers) } : {}),
        visibility: editVisibility || item.visibility,
      }),
    onSuccess: refresh,
  });
  const complete = useMutation({ mutationFn: () => completeTeam(teamId), onSuccess: refresh });
  const archive = useMutation({
    mutationFn: () => archiveTeam(teamId),
    onSuccess: () => onNavigate('/teams'),
  });

  if (invitationPreview && preview.isLoading) return <LoadingState label="Opening invitation" />;
  if (invitationPreview && preview.data)
    return <TeamInvitationPreview preview={preview.data} onNavigate={onNavigate} />;
  if (team.isLoading) return <LoadingState label="Opening team" />;
  if (team.error || !team.data)
    return <ErrorState message={apiErrorMessage(team.error, 'Team not found.')} />;
  const item = team.data;
  const memberItems = collectionItems(members.data).filter((member) =>
    `${member.user?.displayName ?? ''} ${member.user?.username ?? ''} ${member.userId}`
      .toLowerCase()
      .includes(memberSearch.trim().toLowerCase()),
  );
  const activeMemberIds = new Set(
    collectionItems(members.data)
      .filter((member) => member.status === 'ACTIVE')
      .map((member) => member.userId),
  );
  const invitePeopleItems = collectionItems(invitePeople.data).filter(
    (result) => result.type === 'person',
  );
  const isManager = ['OWNER', 'CO_LEAD'].includes(item.membershipRole ?? '');
  const isOwner = item.membershipRole === 'OWNER';
  const full = Boolean(item.maxMembers && (item.memberCount ?? 0) >= item.maxMembers);
  const error =
    membership.error ??
    invite.error ??
    role.error ??
    remove.error ??
    requestReview.error ??
    transfer.error ??
    edit.error ??
    complete.error ??
    archive.error;

  if (!item.isMember) {
    return (
      <section className="page-theme page-theme-teams space-y-5">
        <Card className="overflow-hidden">
          <div className="bg-brand-800 px-5 py-7 text-white sm:px-8">
            <button
              type="button"
              onClick={() => onNavigate('/teams')}
              className="mb-7 text-sm font-semibold text-white/80 hover:text-white"
            >
              ← Teams
            </button>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="brand">{item.category ?? 'Team'}</Badge>
                  <Badge tone="neutral">{item.visibility}</Badge>
                  <Badge tone="neutral">Public details</Badge>
                </div>
                <h1 className="type-display mt-3 text-3xl font-bold">{item.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
                  {item.description || 'A campus team looking for collaborators.'}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>
                Report
              </Button>
            </div>
          </div>
          <div className="space-y-6 p-5 sm:p-8">
            <div className="grid gap-4 border-b border-line pb-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Members</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.memberCount ?? 0}
                  {item.maxMembers ? ` / ${item.maxMembers}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Status</p>
                <p className="mt-1 text-sm font-semibold text-ink">{item.status}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Open-ended'}
                </p>
              </div>
            </div>
            {item.goal ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Goal</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{item.goal}</p>
              </div>
            ) : null}
            {item.tags?.length ? (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </div>
            ) : null}
            {item.membershipStatus === 'PENDING' ? (
              <Button variant="secondary" disabled>
                Requested
              </Button>
            ) : item.visibility === 'PRIVATE' ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                This private team is invitation-only. The owner or a collaborator can invite you.
              </p>
            ) : item.status === 'RECRUITING' || item.status === 'ACTIVE' ? (
              <Button onClick={() => membership.mutate(false)} disabled={membership.isPending}>
                {membership.isPending ? 'Requesting…' : 'Join team'}
              </Button>
            ) : null}
          </div>
        </Card>
        <AdminReportDialog
          open={reportOpen}
          targetType="TEAM"
          targetId={teamId}
          onClose={() => setReportOpen(false)}
        />
      </section>
    );
  }

  return (
    <div className="page-theme page-theme-teams space-y-5">
      <Card className="overflow-hidden">
        <div className="bg-brand-800 px-5 py-7 text-white sm:px-8">
          <button
            type="button"
            onClick={() => onNavigate('/teams')}
            className="mb-7 text-sm font-semibold text-white/80 hover:text-white"
          >
            ← Teams
          </button>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{item.category ?? 'Team'}</Badge>
                <Badge tone="neutral">{item.status}</Badge>
                <Badge tone="neutral">{item.visibility}</Badge>
              </div>
              <h1 className="type-display mt-3 text-3xl font-bold">{item.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{item.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={() => setReportOpen(true)}>Report</Button>
              {item.membershipStatus === 'PENDING' ? (
                <Button size="sm" variant="secondary" disabled>
                  Requested
                </Button>
              ) : item.isMember ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={membership.isPending || isOwner}
                  onClick={() => membership.mutate(true)}
                >
                  {isOwner ? 'Transfer ownership to leave' : 'Leave team'}
                </Button>
              ) : item.status === 'COMPLETED' || item.status === 'ARCHIVED' ? (
                <Button size="sm" variant="secondary" disabled>
                  {item.status}
                </Button>
              ) : full ? (
                <Button size="sm" variant="secondary" disabled>
                  Team full
                </Button>
              ) : item.visibility === 'PRIVATE' ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => membership.mutate(false)}
                  disabled={membership.isPending}
                >
                  Join team
                </Button>
              )}
              {isManager ? (
                <Button size="sm" onClick={() => setTab('manage')}>
                  Manage
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-5 px-5 py-4 text-xs font-semibold text-muted sm:px-8">
          <span>
            {item.memberCount ?? 0}
            {item.maxMembers ? ` / ${item.maxMembers}` : ''} members
          </span>
          <span>
            {item.status === 'COMPLETED'
              ? 'Completed'
              : item.status === 'ARCHIVED'
                ? 'Archived'
                : 'Collaboration active'}
          </span>
        </div>
      </Card>
      <AdminReportDialog open={reportOpen} targetType="TEAM" targetId={teamId} onClose={() => setReportOpen(false)} />
      {error ? (
        <ErrorState message={apiErrorMessage(error, 'Team action could not be completed.')} />
      ) : null}
      <div
        className="flex gap-2 overflow-x-auto border-b border-line pb-2"
        role="tablist"
        aria-label="Team sections"
      >
        {(
          [
            'overview',
            'chat',
            'members',
            ...(isManager ? ['manage'] : []),
            ...(isOwner ? ['settings'] : []),
          ] as TeamTab[]
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
      {tab === 'overview' ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="space-y-5 p-5">
            <h2 className="type-display text-xl font-bold text-ink">Team overview</h2>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Goal</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {item.goal ?? 'This team is building something together.'}
              </p>
            </div>
            <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Category</p>
                <p className="mt-1 text-sm font-semibold text-ink">{item.category ?? 'Team'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Capacity</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.memberCount ?? 0}
                  {item.maxMembers ? ` / ${item.maxMembers}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'Open-ended'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.tags?.length ? (
                  item.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)
                ) : (
                  <span className="text-sm text-muted">No tags added.</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Looking for</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.lookingFor?.length ? (
                  item.lookingFor.map((roleName) => (
                    <Badge key={roleName} tone="neutral">
                      {roleName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted">No open roles listed.</span>
                )}
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Invitations</h2>
            {collectionItems(invitations.data).length ? (
              <div className="mt-3 space-y-3">
                {collectionItems(invitations.data).map((invitation) => (
                  <div key={invitation.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-ink">
                      {invitation.team?.name ?? 'Team invitation'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {invitation.team?.goal ?? 'You were invited to collaborate.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          void queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
                        }
                      >
                        Open invitations
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">No pending team invitations.</p>
            )}
          </Card>
        </section>
      ) : null}
      {tab === 'chat' ? <CommunicationHome teamId={teamId} /> : null}
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
          {isRestrictedApiError(members.error) ? (
            <EmptyState
              title="Membership required"
              description="Join this team to view its members."
            />
          ) : null}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {memberItems.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <Avatar
                  name={member.user?.displayName ?? member.userId}
                  src={member.user?.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">
                    {member.user?.displayName ?? member.userId}
                  </p>
                  <p className="text-xs text-muted">
                    {member.user?.username ? `@${member.user.username} · ` : ''}
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {tab === 'manage' ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Invite members</h2>
            <Field
              className="mt-4"
              label="Search people"
              value={inviteSearch}
              onChange={(event) => {
                setInviteSearch(event.target.value);
                setSelectedInvitee(null);
              }}
              placeholder="Search by name or username"
            />
            {inviteSearch.trim().length > 0 && inviteSearch.trim().length < 2 ? (
              <p className="mt-2 text-xs text-muted">Enter at least 2 characters to search.</p>
            ) : null}
            {invitePeople.isLoading ? <LoadingState label="Searching people" /> : null}
            {invitePeople.error ? (
              <p className="mt-3 text-sm text-red-600">
                {apiErrorMessage(invitePeople.error, 'People search is unavailable.')}
              </p>
            ) : null}
            {!invitePeople.isLoading &&
            !invitePeople.error &&
            inviteSearch.trim().length >= 2 &&
            !invitePeopleItems.length ? (
              <p className="mt-3 text-sm text-muted">No people found for this search.</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {invitePeopleItems.map((result) => {
                const alreadyMember = activeMemberIds.has(result.id);
                const username =
                  typeof result.metadata.username === 'string'
                    ? `@${result.metadata.username}`
                    : undefined;
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      selectedInvitee?.id === result.id
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-line bg-white'
                    }`}
                  >
                    <Avatar name={result.title} src={result.imageUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{result.title}</p>
                      <p className="truncate text-xs text-muted">
                        {username ?? result.snippet ?? 'Campus member'}
                      </p>
                    </div>
                    {alreadyMember ? (
                      <span className="text-xs font-semibold text-muted">Already a member</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={selectedInvitee?.id === result.id ? 'secondary' : 'ghost'}
                        onClick={() => setSelectedInvitee(result)}
                      >
                        {selectedInvitee?.id === result.id ? 'Selected' : 'Select'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedInvitee ? (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Selected person
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">
                    {selectedInvitee.title}
                  </p>
                </div>
                <Button onClick={() => invite.mutate()} disabled={invite.isPending || full}>
                  {full ? 'Team full' : invite.isPending ? 'Inviting…' : 'Invite'}
                </Button>
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">Join requests</h2>
            {requests.isLoading ? <LoadingState label="Loading requests" /> : null}
            <div className="mt-3 space-y-2">
              {collectionItems(requests.data).map((request) => (
                <div key={request.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-ink">{request.userId}</p>
                  <p className="mt-1 text-xs text-muted">
                    {request.message ?? 'Requested to join this team.'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => requestReview.mutate({ requestId: request.id, approve: true })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        requestReview.mutate({ requestId: request.id, approve: false })
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {isOwner ? (
            <Card className="p-5">
              <h2 className="type-display text-lg font-bold text-ink">Transfer ownership</h2>
              <div className="mt-4 flex gap-2">
                <Field
                  className="flex-1"
                  label="Current member user ID"
                  value={transferUserId}
                  onChange={(event) => setTransferUserId(event.target.value)}
                  placeholder="Paste a member user id"
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
            <h2 className="type-display text-lg font-bold text-ink">Manage members</h2>
            <div className="mt-3 space-y-2">
              {memberItems.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3"
                >
                  <span className="mr-auto text-sm font-semibold text-ink">
                    {member.user?.displayName ?? member.userId} · {member.role}
                  </span>
                  {member.role !== 'OWNER' && isOwner ? (
                    <select
                      aria-label={`Role for ${member.userId}`}
                      value={member.role}
                      onChange={(event) =>
                        role.mutate({
                          userId: member.userId,
                          nextRole: event.target.value as 'CO_LEAD' | 'MEMBER',
                        })
                      }
                      className="rounded-lg border border-line bg-white px-2 py-2 text-xs"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="CO_LEAD">CO-LEAD</option>
                    </select>
                  ) : null}
                  {member.role === 'MEMBER' && isManager ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('Remove this member?')) remove.mutate(member.userId);
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}
      {tab === 'settings' ? (
        <section className="grid gap-5">
          <Card className="p-5 lg:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Settings</p>
              <h2 className="type-display mt-1 text-xl font-bold text-ink">Team information</h2>
              <p className="mt-1 text-sm text-muted">
                Update the details people use to understand and discover this team.
              </p>
            </div>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                edit.mutate();
              }}
            >
              <Field
                label="Name"
                value={editName || item.name}
                onChange={(event) => setEditName(event.target.value)}
              />
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Category
                <input
                  value={editCategory || item.category || ''}
                  onChange={(event) => setEditCategory(event.target.value)}
                  className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                />
              </label>
              <TextareaField
                label="Description"
                className="sm:col-span-2"
                value={editDescription || item.description}
                onChange={(event) => setEditDescription(event.target.value)}
              />
              <TextareaField
                label="Goal"
                className="sm:col-span-2"
                value={editGoal || (item.goal ?? '')}
                onChange={(event) => setEditGoal(event.target.value)}
              />
              <Field
                label="Tags (comma separated)"
                value={editTags || item.tags?.join(', ') || ''}
                onChange={(event) => setEditTags(event.target.value)}
                placeholder="React, AI, design"
              />
              <Field
                label="Looking for (comma separated)"
                value={editLookingFor || item.lookingFor?.join(', ') || ''}
                onChange={(event) => setEditLookingFor(event.target.value)}
                placeholder="Designer, backend developer"
              />
              <Field
                label="Deadline"
                type="date"
                value={editDeadline || (item.deadline ? item.deadline.slice(0, 10) : '')}
                onChange={(event) => setEditDeadline(event.target.value)}
              />
              <Field
                label="Avatar image URL"
                value={editAvatarUrl || item.avatarUrl || ''}
                onChange={(event) => setEditAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
              <Field
                label="Maximum members"
                type="number"
                min={1}
                max={100}
                value={editMaxMembers || (item.maxMembers ? String(item.maxMembers) : '')}
                onChange={(event) => setEditMaxMembers(event.target.value)}
              />
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Visibility
                <select
                  value={editVisibility || item.visibility}
                  onChange={(event) => setEditVisibility(event.target.value)}
                  className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="CAMPUS">Campus</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={edit.isPending}>
                  {edit.isPending ? 'Saving…' : 'Save settings'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm('Mark this team as completed?')) complete.mutate();
                  }}
                  disabled={
                    complete.isPending ||
                    (item.status !== 'ACTIVE' && item.status !== 'RECRUITING')
                  }
                >
                  Complete team
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm('Archive this team?')) archive.mutate();
                  }}
                  disabled={archive.isPending}
                >
                  Archive team
                </Button>
              </div>
            </form>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
