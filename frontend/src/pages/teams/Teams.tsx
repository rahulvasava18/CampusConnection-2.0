import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageHeader, CompactPageTop } from '../../components/PageHeader';
import { collectionItems, apiErrorMessage, isRestrictedApiError } from '../../lib/api-state';
import {
  getTeamInvitations,
  getTeams,
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
  const items = collectionItems(teams.data);
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
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((team) => (
          <Card
            key={team.id}
            className="theme-team-card group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            onClick={() => onNavigate(`/teams/${team.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="flex gap-2">
                <Badge tone={team.status === 'COMPLETED' ? 'neutral' : 'success'}>
                  {team.status.toLowerCase()}
                </Badge>
                <Badge tone="neutral">{team.visibility.toLowerCase()}</Badge>
              </div>
            </div>
            <h2 className="type-display mt-5 text-lg font-bold text-ink">{team.name}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
              {team.goal ?? team.description}
            </p>
            <p className="mt-4 text-xs font-semibold text-muted">
              {team.memberCount ?? 0}
              {team.maxMembers ? ` / ${team.maxMembers}` : ''} members{' '}
              {team.category ? `· ${team.category}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {team.tags?.slice(0, 5).map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
