import { useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, Users, Video } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventRegistrationStatus } from '@campusconnection/shared';
import { useAuthStore } from '../../features/auth/auth.store';
import { apiErrorMessage, collectionItems, isRestrictedApiError } from '../../lib/api-state';
import {
  archiveEvent,
  cancelEvent,
  cancelEventRegistration,
  getEvent,
  getEventRegistrations,
  registerForEvent,
  updateEvent,
  updateEventRegistration,
} from '../../features/collaboration/collaboration.api';
import { getClub } from '../../features/club/club.api';
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
import { AdminReportDialog } from '../admin/AdminReportDialog';

export function EventDetail({
  eventId,
  onNavigate,
}: {
  eventId: string;
  onNavigate: (target: string) => void;
}) {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const [reportOpen, setReportOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editMeetingLink, setEditMeetingLink] = useState('');
  const event = useQuery({ queryKey: ['event', eventId], queryFn: () => getEvent(eventId) });
  const item = event.data;
  const isOrganizer = Boolean(item && userId === item.organizerId);
  const organizerClub = useQuery({
    queryKey: ['club', item?.organizerClubId],
    queryFn: () => getClub(item!.organizerClubId!),
    enabled: Boolean(item?.organizerClubId),
  });
  const canManageEvent = isOrganizer || organizerClub.data?.membershipRole === 'OWNER' || organizerClub.data?.membershipRole === 'SECRETARY';
  const registrations = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: () => getEventRegistrations(eventId),
    enabled: canManageEvent,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['event', eventId] });
    void client.invalidateQueries({ queryKey: ['event-registrations', eventId] });
    void client.invalidateQueries({ queryKey: ['events'] });
  };
  const register = useMutation({ mutationFn: () => registerForEvent(eventId), onSuccess: refresh });
  const cancelRegistration = useMutation({
    mutationFn: () => cancelEventRegistration(eventId),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: () =>
      updateEvent(eventId, {
        title: editTitle.trim() || item?.title,
        description: editDescription.trim() || item?.description,
        category: editCategory.trim() || item?.category,
        ...(editVenue.trim() ? { venue: editVenue.trim() } : {}),
        ...(editMeetingLink.trim() ? { meetingLink: editMeetingLink.trim() } : {}),
      }),
    onSuccess: refresh,
  });
  const cancel = useMutation({ mutationFn: () => cancelEvent(eventId), onSuccess: refresh });
  const archive = useMutation({
    mutationFn: () => archiveEvent(eventId),
    onSuccess: () => onNavigate('/events'),
  });
  const manageRegistration = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EventRegistrationStatus }) =>
      updateEventRegistration(eventId, id, status),
    onSuccess: refresh,
  });
  if (event.isLoading) return <LoadingState label="Opening event" />;
  if (event.error || !item)
    return (
      <ErrorState
        message={
          isRestrictedApiError(event.error)
            ? 'This private event is only available to registered participants.'
            : apiErrorMessage(event.error, 'Event not found.')
        }
      />
    );
  const isRegistered = item.registrationStatus === 'REGISTERED' || item.registrationStatus === 'ATTENDED';
  const full = item.capacity !== undefined && (item.availableSeats ?? 0) <= 0;
  const closed = item.registrationDeadline
    ? new Date(item.registrationDeadline) <= new Date()
    : false;
  const actionError =
    register.error ??
    cancelRegistration.error ??
    update.error ??
    cancel.error ??
    archive.error ??
    manageRegistration.error;
  return (
    <div className="page-theme page-theme-events space-y-5">
      <Card className="overflow-hidden">
        <div className="relative">
          {item.coverImageUrl ? (
            <img src={item.coverImageUrl} alt="" className="h-64 w-full object-cover" />
          ) : (
            <div className="flex h-64 items-center justify-center bg-brand-700 text-white">
              <CalendarDays className="h-20 w-20 opacity-80" />
            </div>
          )}
          <Button
            variant="ghost"
            className="absolute left-4 top-4 bg-white/90"
            onClick={() => onNavigate('/events')}
          >
            ← Events
          </Button>
        </div>
        <div className="space-y-5 p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  tone={
                    item.status === 'COMPLETED'
                      ? 'success'
                      : item.status === 'CANCELLED'
                        ? 'neutral'
                        : 'brand'
                  }
                >
                  {item.status}
                </Badge>
                <Badge tone="neutral">{item.visibility}</Badge>
                <Badge tone="neutral">{item.mode}</Badge>
              </div>
              <h1 className="type-display mt-3 text-3xl font-bold text-ink">{item.title}</h1>
              <p className="mt-2 text-sm font-semibold text-brand-700">{item.category}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setReportOpen(true)}>Report</Button>
              {canManageEvent ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    document.getElementById('event-manage')?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  Manage event
                </Button>
              ) : null}
              {item.status === 'CANCELLED' ? (
                <Button disabled>Event cancelled</Button>
              ) : item.status === 'ARCHIVED' ? (
                <Button disabled>Event archived</Button>
              ) : item.status === 'COMPLETED' ? (
                <Button disabled>Event completed</Button>
              ) : !item.registrationRequired ? (
                <Button disabled>No registration required</Button>
              ) : full ? (
                <Button disabled>Event full</Button>
              ) : closed ? (
                <Button disabled>Registration closed</Button>
              ) : item.registrationUrl ? (
                <a className="type-ui inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-px hover:bg-brand-600" href={item.registrationUrl} target="_blank" rel="noreferrer">
                  Register <ExternalLink className="h-4 w-4" />
                </a>
              ) : isRegistered ? (
                <Button variant="secondary" onClick={() => cancelRegistration.mutate()} disabled={cancelRegistration.isPending || item.registrationStatus === 'ATTENDED'}>
                  {item.registrationStatus === 'ATTENDED' ? 'Attended ✓' : 'Registered ✓ · Cancel'}
                </Button>
              ) : (
                <Button onClick={() => register.mutate()} disabled={register.isPending}>
                  {register.isPending ? 'Registering...' : 'Register'}
                </Button>
              )}
            </div>
          </div>
          <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {item.description}
          </p>
          <div className="grid gap-3 border-t border-line pt-5 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 text-brand-500" />
              {new Date(item.startAt).toLocaleString()}
              <br />
              to {new Date(item.endAt).toLocaleString()}
            </p>
            <p className="flex items-start gap-2">
              {item.mode === 'ONLINE' ? (
                <Video className="h-4 w-4 text-brand-500" />
              ) : (
                <MapPin className="h-4 w-4 text-brand-500" />
              )}
              {item.venue ?? 'Online event'}
              {item.meetingLink ? (
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </p>
            <p className="flex items-start gap-2">
              <Users className="h-4 w-4 text-brand-500" />
              {item.capacity !== undefined
                ? `${item.registrationCount} / ${item.capacity} registered`
                : `${item.registrationCount} registered`}
            </p>
            <p>
              {organizerClub.data ? 'Organized by' : 'Organizer'}
              <br />
              {organizerClub.data ? (
                <button
                  type="button"
                  className="font-semibold text-brand-700 hover:text-brand-900"
                  onClick={() => onNavigate(`/clubs/${organizerClub.data?.id}`)}
                >
                  {organizerClub.data.name} ✓
                </button>
              ) : (
                <strong className="text-ink">
                  {item.organizer?.displayName ?? 'Campus organizer'}
                </strong>
              )}
            </p>
          </div>
          {item.registrationDeadline ? (
            <p className="text-xs font-semibold text-muted">
              Registration closes {new Date(item.registrationDeadline).toLocaleString()}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </Card>
      <AdminReportDialog open={reportOpen} targetType="EVENT" targetId={eventId} onClose={() => setReportOpen(false)} />
      {actionError ? (
        <ErrorState
          message={apiErrorMessage(actionError, 'Event action could not be completed.')}
        />
      ) : null}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">Rules and instructions</h2>
          {item.rules.length ? (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {item.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No additional instructions were provided.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="type-display text-xl font-bold text-ink">Related campus work</h2>
          {item.teamId || item.communityId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.teamId ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(`/teams/${item.teamId}`)}
                >
                  Open related team
                </Button>
              ) : null}
              {item.communityId ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onNavigate(`/communities/${item.communityId}`)}
                >
                  Open related community
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">This event is independently organized.</p>
          )}
        </Card>
      </section>
      {canManageEvent ? (
        <section id="event-manage" className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="type-display text-xl font-bold text-ink">Manage event</h2>
            <div className="mt-4 grid gap-3">
              <Field
                label="Title"
                value={editTitle || item.title}
                onChange={(event) => setEditTitle(event.target.value)}
              />
              <TextareaField
                label="Description"
                value={editDescription || item.description}
                onChange={(event) => setEditDescription(event.target.value)}
              />
              <Field
                label="Category"
                value={editCategory || item.category}
                onChange={(event) => setEditCategory(event.target.value)}
              />
              <Field
                label="Venue"
                value={editVenue || item.venue || ''}
                onChange={(event) => setEditVenue(event.target.value)}
              />
              <Field
                label="Meeting link"
                value={editMeetingLink || item.meetingLink || ''}
                onChange={(event) => setEditMeetingLink(event.target.value)}
              />
              <Button onClick={() => update.mutate()} disabled={update.isPending}>
                Save event details
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (window.confirm('Cancel this event?')) cancel.mutate();
                  }}
                  disabled={cancel.isPending || item.status === 'CANCELLED'}
                >
                  Cancel event
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm('Archive this event?')) archive.mutate();
                  }}
                  disabled={archive.isPending}
                >
                  Archive event
                </Button>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="type-display text-xl font-bold text-ink">
              Registered users · {item.registrationCount}
            </h2>
            {registrations.isLoading ? <LoadingState label="Loading registered users" /> : null}
            {registrations.error ? (
              <ErrorState
                message={apiErrorMessage(registrations.error, 'Participants could not be loaded.')}
              />
            ) : null}
            <div className="mt-4 space-y-2">
              {collectionItems(registrations.data).map((registration) => (
                <div
                  key={registration.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"
                >
                  <Avatar
                    size="sm"
                    name={registration.user?.displayName ?? registration.userId}
                    src={registration.user?.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">
                      {registration.user?.displayName ?? registration.userId}
                    </p>
                    <p className="text-xs text-muted">
                      {registration.user?.username ? `@${registration.user.username} · ` : ''}
                      {new Date(registration.registeredAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={registration.status === 'REGISTERED' ? 'success' : 'neutral'}>
                    {registration.status}
                  </Badge>
                  {registration.status === 'REGISTERED' ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          manageRegistration.mutate({ id: registration.id, status: 'ATTENDED' })
                        }
                      >
                        Attended
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          manageRegistration.mutate({ id: registration.id, status: 'NO_SHOW' })
                        }
                      >
                        No show
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
              {!collectionItems(registrations.data).length ? (
                <EmptyState
                  title="No registrations yet"
                  description="Registered participants will appear here."
                />
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
