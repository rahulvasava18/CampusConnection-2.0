import { BadgeCheck, CalendarDays, Users } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClub, getClubEvents, getClubMembers, getClubRequests, joinClub, reviewClubRequest, updateClubMemberRole } from '../../features/club/club.api';
import { apiErrorMessage, collectionItems } from '../../lib/api-state';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageHeader } from '../../components/PageHeader';

type Tab = 'overview' | 'events' | 'members' | 'manage';

export function ClubDetail({ clubId, onNavigate }: { clubId: string; onNavigate: (target: string) => void }) {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => getClub(clubId) });
  const members = useQuery({ queryKey: ['club-members', clubId], queryFn: () => getClubMembers(clubId), enabled: Boolean(club.data?.isMember) });
  const events = useQuery({ queryKey: ['club-events', clubId], queryFn: () => getClubEvents(clubId), enabled: tab === 'events' || tab === 'overview' });
  const requests = useQuery({ queryKey: ['club-requests', clubId], queryFn: () => getClubRequests(clubId), enabled: tab === 'manage' && club.data?.membershipRole === 'OWNER' && club.data.status === 'APPROVED' });
  const join = useMutation({ mutationFn: () => joinClub(clubId), onSuccess: () => void client.invalidateQueries({ queryKey: ['club', clubId] }) });
  const review = useMutation({ mutationFn: ({ id, approve }: { id: string; approve: boolean }) => reviewClubRequest(clubId, id, approve), onSuccess: () => { void client.invalidateQueries({ queryKey: ['club-requests', clubId] }); void client.invalidateQueries({ queryKey: ['club-members', clubId] }); } });
  const role = useMutation({ mutationFn: ({ userId, next }: { userId: string; next: 'SECRETARY' | 'MEMBER' }) => updateClubMemberRole(clubId, userId, next), onSuccess: () => void client.invalidateQueries({ queryKey: ['club-members', clubId] }) });
  if (club.isLoading) return <LoadingState label="Opening club" />;
  if (club.error || !club.data) return <ErrorState message={apiErrorMessage(club.error, 'Club not found.')} />;
  const item = club.data;
  const eventItems = collectionItems(events.data);
  const memberItems = collectionItems(members.data);
  const requestItems = collectionItems(requests.data);
  const canManage = item.membershipRole === 'OWNER' && item.status === 'APPROVED';
  const canCreateEvent = item.status === 'APPROVED' && (item.membershipRole === 'OWNER' || item.membershipRole === 'SECRETARY');
  const tabs: Tab[] = canManage ? ['overview', 'events', 'members', 'manage'] : ['overview', 'events', 'members'];
  return (
    <div className="space-y-6">
      <CompactPageHeader eyebrow="Workspace / Club" title={item.name} description={item.shortDescription ?? item.description} action={<div className="flex flex-wrap items-center gap-2">{item.status === 'APPROVED' ? <Badge tone="success"><BadgeCheck className="mr-1 h-3.5 w-3.5" />Verified organization</Badge> : <Badge tone="warning">{item.status}</Badge>}{item.isMember ? <Badge tone="brand">{item.membershipRole}</Badge> : item.status === 'APPROVED' ? <Button onClick={() => join.mutate()} disabled={join.isPending || item.joinRequestStatus === 'PENDING'}>{item.joinRequestStatus === 'PENDING' ? 'Request pending' : item.privacy === 'PRIVATE' ? 'Request access' : 'Join club'}</Button> : null}</div>} />
      <Card className="overflow-hidden">
        <div className="relative h-44 bg-brand-700">{item.bannerUrl ? <img src={item.bannerUrl} alt="" className="h-full w-full object-cover" /> : null}<div className="absolute bottom-4 left-5 flex items-center gap-3 text-white"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-brand-700 shadow-lg">{item.logoUrl ? <img src={item.logoUrl} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Users className="h-7 w-7" />}</div><div><h1 className="text-2xl font-bold">{item.name}</h1><p className="text-sm text-blue-100">{item.category} · {item.privacy.toLowerCase()} · {item.memberCount} members</p></div></div></div>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">{tabs.map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${tab === value ? 'bg-brand-600 text-white' : 'text-muted hover:bg-brand-50'}`}>{value}</button>)}</div>
      </Card>
      {tab === 'overview' ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><Card className="p-5"><h2 className="type-display text-xl font-bold text-ink">About the club</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">{item.description}</p><div className="mt-5 flex flex-wrap gap-2">{item.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div></Card><Card className="p-5"><h2 className="type-display text-lg font-bold text-ink">Club snapshot</h2><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><span className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl text-ink">{item.memberCount}</strong>members</span><span className="rounded-xl bg-slate-50 p-3"><strong className="block text-xl text-ink">{item.eventCount}</strong>events</span></div></Card></div> : null}
      {tab === 'events' ? <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="type-display text-xl font-bold text-ink">Club events</h2><p className="mt-1 text-sm text-muted">Organized by {item.name} <BadgeCheck className="inline h-4 w-4 text-emerald-600" aria-label="Verified organization" /></p></div>{canCreateEvent ? <Button onClick={() => onNavigate(`/clubs/${clubId}/events/create`)}>Create event</Button> : null}</div>{!eventItems.length ? <EmptyState title="No club events yet" description="Approved club owners and secretaries can publish the first event." /> : <div className="mt-4 grid gap-3 md:grid-cols-2">{eventItems.map((event) => <button key={event.id} type="button" onClick={() => onNavigate(`/events/${event.id}`)} className="rounded-2xl border border-line p-4 text-left hover:border-brand-300"><CalendarDays className="h-5 w-5 text-brand-600" /><h3 className="mt-3 font-bold text-ink">{event.title}</h3><p className="mt-1 text-sm text-muted">Organized by {item.name} · {new Date(event.startAt).toLocaleString()}</p></button>)}</div>}</Card> : null}
      {tab === 'members' ? <Card className="p-5"><h2 className="type-display text-xl font-bold text-ink">Members</h2>{!memberItems.length ? <EmptyState title="Members are private" description="Join this club to view its members." /> : <div className="mt-4 grid gap-2">{memberItems.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Avatar name={member.user?.displayName ?? 'Member'} src={member.user?.avatarUrl} size="sm" /><div className="min-w-0 flex-1"><p className="font-semibold text-ink">{member.user?.displayName ?? member.userId}</p><p className="text-xs text-muted">@{member.user?.username ?? 'member'} · {member.role}</p></div>{canManage && member.role !== 'OWNER' ? <Button size="sm" variant="ghost" onClick={() => role.mutate({ userId: member.userId, next: member.role === 'SECRETARY' ? 'MEMBER' : 'SECRETARY' })}>{member.role === 'SECRETARY' ? 'Remove secretary' : 'Promote'}</Button> : null}</div>)}</div>}</Card> : null}
      {tab === 'manage' && canManage ? <div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><h2 className="type-display text-xl font-bold text-ink">Join requests</h2>{requestItems.map((request) => <div key={request.id} className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold text-ink">{request.userId}</span><div className="flex gap-2"><Button size="sm" onClick={() => review.mutate({ id: request.id, approve: true })}>Approve</Button><Button size="sm" variant="secondary" onClick={() => review.mutate({ id: request.id, approve: false })}>Reject</Button></div></div>)}{!requestItems.length ? <p className="mt-3 text-sm text-muted">No pending requests.</p> : null}</Card><Card className="p-5"><h2 className="type-display text-xl font-bold text-ink">Verified club management</h2><p className="mt-3 text-sm leading-6 text-muted">Owners manage membership and secretaries. Secretaries can create official events, but cannot change ownership.</p></Card></div> : null}
    </div>
  );
}
