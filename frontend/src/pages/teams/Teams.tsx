import { ChevronRight, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageHeader, CompactPageTop } from '../../components/PageHeader';
import { collectionItems, apiErrorMessage, isRestrictedApiError } from '../../lib/api-state';
import {
  getTeamInvitations,
  getTeams,
  joinTeam,
  respondToTeamInvitation,
} from '../../features/collaboration/collaboration.api';

export function Teams({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [available, setAvailable] = useState(false);
  const teams = useQuery({
    queryKey: ['teams', { search, category, tags, available }],
    queryFn: () => getTeams({ search, category, tags, available }),
  });
  const invitations = useQuery({ queryKey: ['team-invitations'], queryFn: getTeamInvitations });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToTeamInvitation(id, accept),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
  const join = useMutation({
    mutationFn: (teamId: string) => joinTeam(teamId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      void queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
  const items = collectionItems(teams.data);
  const userTeams = items.filter((team) => team.isMember || team.membershipRole === 'OWNER');
  const pendingInvitations = collectionItems(invitations.data);

  return (
    <div className="page-theme page-theme-teams space-y-6">
      <CompactPageTop
        control={
          <Card className="space-y-4 p-4 sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
          <Search className="h-5 w-5 text-brand-500" aria-hidden="true" />
          <span className="sr-only">Search teams</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search teams by name, goal, or description"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            aria-label="Team category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          />
          <input
            aria-label="Team tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          />
          <select
            aria-label="Team status"
            value={available ? 'AVAILABLE' : 'ALL'}
            onChange={(event) => setAvailable(event.target.value === 'AVAILABLE')}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
          >
            <option value="ALL">All teams</option>
            <option value="AVAILABLE">Recruiting teams</option>
          </select>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setCategory('');
              setTags('');
              setAvailable(false);
            }}
          >
            Clear
          </Button>
        </div>
          </Card>
        }
        header={
          <CompactPageHeader
            eyebrow="Workspace / Teams"
            title="Find team and roles."
            description="Browse goal-oriented campus teams and join an active effort."
            action={<Button onClick={() => onNavigate('/teams/create')}>Create team</Button>}
          />
        }
      />
      {pendingInvitations.length ? (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="type-display text-lg font-bold text-ink">Team invitations</h2>
              <p className="mt-1 text-sm text-muted">Respond to invitations waiting for you.</p>
            </div>
            <Badge tone="brand">{pendingInvitations.length} pending</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="rounded-xl bg-slate-50 p-4">
                <p className="font-bold text-ink">{invitation.team?.name ?? 'Team invitation'}</p>
                <p className="mt-1 text-sm text-muted">
                  {invitation.team?.goal ?? 'You have been invited to collaborate.'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => respond.mutate({ id: invitation.id, accept: true })}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => respond.mutate({ id: invitation.id, accept: false })}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {teams.isLoading ? <LoadingState label="Finding teams" /> : null}
      {isRestrictedApiError(teams.error) ? (
        <ErrorState message="Verify your email to discover teams." />
      ) : teams.error ? (
        <ErrorState
          message={apiErrorMessage(teams.error, 'Teams could not be loaded.')}
          onRetry={() => void teams.refetch()}
        />
      ) : null}
      {!teams.isLoading && !teams.error && !items.length ? (
        <EmptyState
          title="No teams found"
          description="Try another search or create a team for your next goal."
          action={<Button onClick={() => onNavigate('/teams/create')}>Create team</Button>}
        />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4 md:grid-cols-2">
        {items.map((team) => (
          <Card
            key={team.id}
            className="theme-team-card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Users className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex gap-2">
                <Badge tone={team.status === 'COMPLETED' ? 'neutral' : 'success'}>
                  {team.status.toLowerCase()}
                </Badge>
                <Badge tone="neutral">{team.visibility.toLowerCase()}</Badge>
              </div>
            </div>
            <h2 className="type-display mt-4 text-xl font-bold text-ink">{team.name}</h2>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
              {team.goal ?? team.description}
            </p>
            <p className="mt-4 text-sm font-semibold text-muted">
              {team.memberCount ?? 0}
              {team.maxMembers ? ` / ${team.maxMembers}` : ''} members{' '}
              {team.category ? `· ${team.category}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {team.tags?.slice(0, 5).map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {team.isMember ? (
                <Button size="sm" onClick={() => onNavigate(`/teams/${team.id}`)} className="min-h-10 rounded-xl px-4">
                  Enter →
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(`/teams/${team.id}`)}
                  className="min-h-10 rounded-xl px-4"
                >
                  More details →
                </Button>
              )}
              {!team.isMember && team.visibility !== 'PRIVATE' ? (
                team.membershipStatus === 'PENDING' ? (
                  <Button size="sm" variant="ghost" disabled className="min-h-10 rounded-xl px-4">
                    Requested
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => join.mutate(team.id)}
                    disabled={join.isPending && join.variables === team.id}
                    className="min-h-10 rounded-xl px-4"
                  >
                    {join.isPending && join.variables === team.id ? 'Requesting…' : 'Join'}
                  </Button>
                )
              ) : null}
            </div>
          </Card>
        ))}
        </div>
        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">My Teams</h2>
            {userTeams.length ? (
              <div className="mt-4 space-y-2">
                {userTeams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => onNavigate(`/teams/${team.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-slate-50 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{team.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {team.memberCount ?? 0} members
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                No teams yet. Join or create your first team.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
