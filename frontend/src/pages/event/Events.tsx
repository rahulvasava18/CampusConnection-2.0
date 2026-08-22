import { CalendarDays, MapPin, Search, Users, Video } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventView } from '@campusconnection/shared';
import { getEvents } from '../../features/collaboration/collaboration.api';
import { apiErrorMessage, collectionItems, isRestrictedApiError } from '../../lib/api-state';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageTop } from '../../components/PageHeader';
import { WorkspaceCreateCard } from '../../components/WorkspaceCreateCard';

function EventCard({ event, onOpen, onNavigate }: { event: EventView; onOpen: () => void; onNavigate: (target: string) => void }) {
  return (
    <Card className="theme-event-card overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      {event.coverImageUrl ? (
        <img src={event.coverImageUrl} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 items-center justify-center bg-brand-700 text-white">
          <CalendarDays className="h-12 w-12 opacity-80" />
        </div>
      )}
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              event.status === 'COMPLETED'
                ? 'success'
                : event.status === 'CANCELLED'
                  ? 'neutral'
                  : 'brand'
            }
          >
            {event.status}
          </Badge>
          <Badge tone="neutral">{event.mode}</Badge>
        </div>
        <div>
          <h2 className="type-display text-xl font-bold text-ink">{event.title}</h2>
          <p className="mt-1 text-sm font-semibold text-brand-700">{event.category}</p>
          {event.organizerClub ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
              onClick={() => onNavigate(`/clubs/${event.organizerClub?.id}`)}
            >
              Organized by {event.organizerClub.name} ✓
            </button>
          ) : null}
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{event.description}</p>
        </div>
        <div className="space-y-2 text-xs font-semibold text-muted">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-500" />
            {new Date(event.startAt).toLocaleString()}
          </p>
          <p className="flex items-center gap-2">
            {event.mode === 'ONLINE' ? (
              <Video className="h-4 w-4 text-brand-500" />
            ) : (
              <MapPin className="h-4 w-4 text-brand-500" />
            )}
            {event.venue ?? (event.mode === 'ONLINE' ? 'Online event' : 'Venue to be announced')}
          </p>
          {event.capacity !== undefined ? (
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-500" />
              {event.registrationCount} / {event.capacity} registered
            </p>
          ) : (
            <p>{event.registrationCount} registered</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.tags.slice(0, 4).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
        <Button className="w-full" variant="secondary" onClick={onOpen}>
          View event
        </Button>
      </div>
    </Card>
  );
}

export function Events({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('All');
  const [mode, setMode] = useState('All');
  const [available, setAvailable] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const events = useQuery({
    queryKey: ['events', { search, category, tags, status, mode, available, from, to }],
    queryFn: () =>
      getEvents({
        search,
        category,
        tags,
        status,
        mode,
        available,
        ...(from ? { from: new Date(`${from}T00:00:00.000Z`).toISOString() } : {}),
        ...(to ? { to: new Date(`${to}T23:59:59.999Z`).toISOString() } : {}),
      }),
  });
  const items = collectionItems(events.data);
  return (
    <div className="page-theme page-theme-events space-y-6">
      <CompactPageTop
        control={
          <Card className="space-y-4 p-4 sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
          <Search className="h-5 w-5 text-brand-500" />
          <span className="sr-only">Search events</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            aria-label="Event category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none"
          />
          <input
            aria-label="Event tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Tags, comma separated"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none"
          />
          <select
            aria-label="Event mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm"
          >
            <option>All</option>
            <option>OFFLINE</option>
            <option>ONLINE</option>
            <option>HYBRID</option>
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-muted">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />{' '}
            Available seats
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', 'UPCOMING', 'ONGOING', 'COMPLETED'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full px-4 py-2 text-xs font-bold ${status === item ? 'bg-brand-600 text-white' : 'bg-white text-muted ring-1 ring-line'}`}
            >
              {item === 'All' ? 'All events' : item}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted">
            From{' '}
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-line px-2 py-1.5"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted">
            To{' '}
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-line px-2 py-1.5"
            />
          </label>
        </div>
          </Card>
        }
        header={
          <WorkspaceCreateCard kind="events" onAction={() => onNavigate('/events')} />
        }
      />
      {events.isLoading ? <LoadingState label="Finding events" /> : null}
      {isRestrictedApiError(events.error) ? (
        <ErrorState message="Verify your email to discover events." />
      ) : events.error ? (
        <ErrorState
          message={apiErrorMessage(events.error, 'Events could not be loaded.')}
          onRetry={() => void events.refetch()}
        />
      ) : null}
      {!events.isLoading && !events.error && !items.length ? (
        <EmptyState
          title="No events found"
            description="Try another filter or open a verified club to see its upcoming events."
        />
      ) : null}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onOpen={() => onNavigate(`/events/${event.id}`)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
