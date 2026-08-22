import { useState } from 'react';
import { BadgeCheck, Building2, Globe2, LockKeyhole, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClubView } from '@campusconnection/shared';
import {
  getClubInvitations,
  getClubs,
  getMyClubs,
  joinClub,
  respondToClubInvitation,
} from '../../features/club/club.api';
import { apiErrorMessage, collectionItems } from '../../lib/api-state';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageHeader, CompactPageTop } from '../../components/PageHeader';

function ClubCard({
  club,
  onOpen,
  onJoin,
  busy,
  ownApplication = false,
}: {
  club: ClubView;
  onOpen: () => void;
  onJoin?: () => void;
  busy?: boolean;
  ownApplication?: boolean;
}) {
  const isPrivate = club.privacy === 'PRIVATE';
  const canJoin = club.status === 'APPROVED' && !club.isMember && !ownApplication;
  const actionLabel = club.joinRequestStatus === 'PENDING'
    ? 'Request pending'
    : isPrivate
      ? 'Request access'
      : 'Join request';

  return (
    <Card className={`theme-club-card overflow-hidden border-l-4 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md ${isPrivate ? 'border-l-violet-400' : 'border-l-brand-400'}`}>
      <div className="flex items-start gap-4 p-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          {club.logoUrl ? <img src={club.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-display font-bold text-ink">{club.name}</h2>
            {club.status === 'APPROVED' ? <Badge tone="success"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified</Badge> : <Badge tone={club.status === 'REJECTED' ? 'danger' : 'warning'}>{club.status}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1 text-brand-700">{isPrivate ? <LockKeyhole className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}{isPrivate ? 'Private' : 'Public'}</span>
            <span>·</span>
            <span>{club.category}</span>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5">
        <p className="line-clamp-3 text-sm leading-6 text-muted">{club.shortDescription ?? club.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-muted">
          <span>{club.memberCount} members · {club.eventCount} events</span>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onOpen}>More info</Button>
            {club.isMember ? <Button size="sm" variant="secondary" onClick={onOpen}>Joined · Enter club</Button> : canJoin ? <Button size="sm" onClick={onJoin} disabled={busy || club.joinRequestStatus === 'PENDING'}>{actionLabel}</Button> : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InvitationCard({ name, onAccept, onDecline, busy }: { name: string; onAccept: () => void; onDecline: () => void; busy: boolean }) {
  return <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-ink">{name}</p><p className="mt-1 text-xs text-muted">You have been invited to join this club.</p></div><div className="flex gap-2"><Button size="sm" onClick={onAccept} disabled={busy}>Accept</Button><Button size="sm" variant="secondary" onClick={onDecline} disabled={busy}>Decline</Button></div></div>;
}

export function Clubs({ onNavigate }: { onNavigate: (target: string) => void }) {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [privacy, setPrivacy] = useState('All');
  const clubs = useQuery({ queryKey: ['clubs', search, category, privacy], queryFn: () => getClubs({ search, category, privacy }) });
  const mine = useQuery({ queryKey: ['clubs', 'mine'], queryFn: getMyClubs });
  const invitations = useQuery({ queryKey: ['club-invitations'], queryFn: getClubInvitations });
  const join = useMutation({ mutationFn: (id: string) => joinClub(id), onSuccess: () => void client.invalidateQueries({ queryKey: ['clubs'] }) });
  const invitation = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondToClubInvitation(id, accept), onSuccess: () => { void client.invalidateQueries({ queryKey: ['club-invitations'] }); void client.invalidateQueries({ queryKey: ['clubs'] }); } });
  const items = collectionItems(clubs.data);
  const ownItems = collectionItems(mine.data);
  const invites = collectionItems(invitations.data);

  return <div className="page-theme page-theme-clubs space-y-6">
    <CompactPageTop control={<Card className="space-y-4 p-4 sm:p-5"><label className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3"><Search className="h-5 w-5 text-brand-500" /><span className="sr-only">Search clubs</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clubs..." className="min-h-11 flex-1 bg-transparent text-sm text-ink outline-none" /></label><div className="flex flex-wrap gap-2" aria-label="Club category filters">{['All', 'Academic', 'Technical', 'Cultural', 'Sports', 'Entrepreneurship', 'Other'].map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${category === item ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-muted ring-1 ring-line hover:bg-brand-50 hover:text-brand-800'}`}>{item}</button>)}</div><div className="flex flex-wrap gap-2" aria-label="Club privacy filters">{['All', 'PUBLIC', 'PRIVATE'].map((item) => <button key={item} type="button" onClick={() => setPrivacy(item)} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${privacy === item ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-muted ring-1 ring-line hover:bg-brand-50 hover:text-brand-800'}`}>{item === 'All' ? 'All visibility' : item === 'PUBLIC' ? 'Public' : 'Private'}</button>)}</div></Card>} header={<CompactPageHeader eyebrow="Workspace / Clubs" title="Organize what your campus cares about." description="Discover verified student organizations, join a club, and find the events that bring campus life together." action={<Button onClick={() => onNavigate('/clubs/create')}>Create a club</Button>} />} />
    {invites.length ? <Card className="p-5 sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="type-ui text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Invitations</p><h2 className="type-display mt-1 text-xl font-bold text-ink">Club invitations</h2></div><Badge tone="brand">{invites.length} pending</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{invites.map((item) => <InvitationCard key={item.id} name={item.club?.name ?? 'Club invitation'} onAccept={() => invitation.mutate({ id: item.id, accept: true })} onDecline={() => invitation.mutate({ id: item.id, accept: false })} busy={invitation.isPending && invitation.variables?.id === item.id} />)}</div></Card> : null}
    {ownItems.length ? <section className="space-y-3"><div><p className="type-ui text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Your applications</p><h2 className="type-display mt-1 text-xl font-bold text-ink">Club verification status</h2></div><div className="grid gap-4 md:grid-cols-2">{ownItems.map((club) => <ClubCard key={club.id} club={club} ownApplication onOpen={() => onNavigate(`/clubs/${club.id}`)} />)}</div></section> : null}
    <section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="type-ui text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Verified organizations</p><h2 className="type-display mt-1 text-xl font-bold text-ink">Discover clubs</h2></div>{!clubs.isLoading && !clubs.error ? <span className="text-sm font-semibold text-muted">{items.length} shown</span> : null}</div>{clubs.isLoading ? <LoadingState label="Finding clubs" /> : null}{clubs.error ? <ErrorState message={apiErrorMessage(clubs.error, 'Clubs could not be loaded.')} onRetry={() => void clubs.refetch()} /> : null}{!clubs.isLoading && !clubs.error && !items.length ? <EmptyState title="No clubs found" description="Try another search or filter, or submit a club application." action={<Button onClick={() => onNavigate('/clubs/create')}>Create a club</Button>} /> : null}<div className="grid gap-4 md:grid-cols-2">{items.map((club) => <ClubCard key={club.id} club={club} onOpen={() => onNavigate(`/clubs/${club.id}`)} onJoin={() => join.mutate(club.id)} busy={join.isPending && join.variables === club.id} />)}</div></section>
  </div>;
}
