import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createEvent } from '../../features/collaboration/collaboration.api';
import { createClubEvent, getClub } from '../../features/club/club.api';
import { useAuthStore } from '../../features/auth/auth.store';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, LoadingState, RestrictedState, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const eventCreateSchema = z.object({
  title: z.string().trim().min(2, 'Event name is required.').max(180),
  description: z.string().trim().min(1, 'Event description is required.').max(5000),
  category: z.string().trim().min(1, 'Category is required.').max(80),
  tags: z.string().optional(),
  coverImageUrl: z.string().url('Use a valid image URL.').optional().or(z.literal('')),
  venue: z.string().optional(),
  mode: z.enum(['OFFLINE', 'ONLINE', 'HYBRID']),
  meetingLink: z.string().url('Use a valid meeting URL.').optional().or(z.literal('')),
  startAt: z.string().min(1, 'Start time is required.'),
  endAt: z.string().min(1, 'End time is required.'),
  registrationDeadline: z.string().optional(),
  capacity: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(100000).optional(),
  ),
  registrationRequired: z.boolean(),
  registrationUrl: z.string().url('Use a valid registration URL.').optional().or(z.literal('')),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  rules: z.string().optional(),
  teamId: z.string().optional(),
  communityId: z.string().optional(),
}).superRefine((value, context) => {
  const start = new Date(value.startAt).getTime();
  const end = new Date(value.endAt).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    context.addIssue({ code: 'custom', path: ['endAt'], message: 'End time must be after the start time.' });
  }
  if (value.registrationRequired && !value.registrationUrl?.trim()) {
    context.addIssue({ code: 'custom', path: ['registrationUrl'], message: 'Registration URL is required when registration is enabled.' });
  }
  if (value.registrationDeadline && Number.isFinite(start) && new Date(value.registrationDeadline).getTime() >= start) {
    context.addIssue({ code: 'custom', path: ['registrationDeadline'], message: 'Registration must close before the event starts.' });
  }
});

type EventFormInput = z.input<typeof eventCreateSchema>;
type EventForm = z.output<typeof eventCreateSchema>;
const toIso = (value: string) => new Date(value).toISOString();

export function CreateEvent({ onNavigate, clubId }: { onNavigate: (target: string) => void; clubId?: string }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const club = useQuery({ queryKey: ['club', clubId], queryFn: () => getClub(clubId!), enabled: Boolean(clubId) });
  const form = useForm<EventFormInput, unknown, EventForm>({
    resolver: zodResolver(eventCreateSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'Workshop',
      tags: '',
      coverImageUrl: '',
      venue: '',
      mode: 'OFFLINE',
      meetingLink: '',
      startAt: '',
      endAt: '',
      registrationDeadline: '',
      capacity: undefined,
      registrationRequired: true,
      registrationUrl: '',
      visibility: 'PUBLIC',
      rules: '',
      teamId: '',
      communityId: '',
    },
  });
  const registrationRequired = form.watch('registrationRequired');
  const mutation = useMutation({
    mutationFn: (input: EventForm) => {
      const { tags, coverImageUrl, registrationDeadline, rules, teamId, communityId, registrationUrl, ...base } =
        input;
      const payload = {
        ...base,
        startAt: toIso(input.startAt),
        endAt: toIso(input.endAt),
        tags:
          tags
            ?.split(',')
            .map((item) => item.trim())
            .filter(Boolean) ?? [],
        rules:
          rules
            ?.split(',')
            .map((item) => item.trim())
            .filter(Boolean) ?? [],
        ...(coverImageUrl?.trim() ? { coverImageUrl: coverImageUrl.trim() } : {}),
        ...(registrationRequired && registrationDeadline ? { registrationDeadline: toIso(registrationDeadline) } : {}),
        ...(teamId?.trim() ? { teamId: teamId.trim() } : {}),
        ...(communityId?.trim() ? { communityId: communityId.trim() } : {}),
        ...(registrationRequired && registrationUrl?.trim() ? { registrationUrl: registrationUrl.trim() } : {}),
      };
      return clubId ? createClubEvent(clubId, payload) : createEvent(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      onNavigate(clubId ? `/clubs/${clubId}` : '/events');
    },
  });

  if (clubId && club.isLoading) return <LoadingState label="Checking club permissions" />;
  if (clubId && (club.error || !club.data)) return <ErrorState message={apiErrorMessage(club.error, 'Club permissions could not be loaded.')} />;
  if (clubId && (club.data?.status !== 'APPROVED' || !['OWNER', 'SECRETARY'].includes(club.data.membershipRole ?? ''))) {
    return <RestrictedState message="Only an approved club owner or secretary can create official club events." />;
  }

  return (
    <CreateResourceLayout
      eyebrow="Workspace / Events / Create"
      title="Create an event"
      description="Bring your campus together with a clear, well-organized event."
      backLabel={clubId ? 'Club' : 'Events'}
      onBack={() => onNavigate(clubId ? `/clubs/${clubId}` : '/events')}
    >
      <Card className="p-5 sm:p-7">
        <div className="mb-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
          <strong>Organizer:</strong> {club.data ? <>{club.data.name} <span className="text-emerald-700">✓</span><span className="mt-1 block text-xs font-normal text-muted">Created by {user?.displayName ?? 'your account'}</span></> : <>{user?.displayName ?? 'Your account'} {user?.username ? `(@${user.username})` : ''}</>}
        </div>
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
        >
          <Field
            label="Event name"
            placeholder="Campus hackathon"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />
          <TextareaField
            label="Description"
            placeholder="What should attendees know?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <Field
            label="Category"
            placeholder="Workshop, hackathon, cultural"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
          <Field
            label="Tags (comma separated)"
            placeholder="AI, campus, technology"
            {...form.register('tags')}
          />
          <Field
            label="Cover image URL (optional)"
            placeholder="https://..."
            error={form.formState.errors.coverImageUrl?.message}
            {...form.register('coverImageUrl')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Mode
              <select
                className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink"
                {...form.register('mode')}
              >
                <option value="OFFLINE">Offline</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </label>
            <Field
              label="Venue (required offline/hybrid)"
              placeholder="Main auditorium"
              {...form.register('venue')}
            />
          </div>
          <Field
            label="Meeting link (required online/hybrid)"
            placeholder="https://meet.example.com/..."
            error={form.formState.errors.meetingLink?.message}
            {...form.register('meetingLink')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Start date and time"
              type="datetime-local"
              error={form.formState.errors.startAt?.message}
              {...form.register('startAt')}
            />
            <Field
              label="End date and time"
              type="datetime-local"
              error={form.formState.errors.endAt?.message}
              {...form.register('endAt')}
            />
            {registrationRequired ? <Field
              label="Registration closes (optional)"
              type="datetime-local"
              error={form.formState.errors.registrationDeadline?.message}
              {...form.register('registrationDeadline')}
            /> : null}
            <Field
              label="Capacity (optional)"
              type="number"
              min={1}
              placeholder="200"
              error={form.formState.errors.capacity?.message}
              {...form.register('capacity')}
            />
          </div>
          <Field
            label="Rules / instructions (comma separated)"
            placeholder="Bring your student ID, arrive 15 minutes early"
            {...form.register('rules')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Visibility
              <select
                className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink"
                {...form.register('visibility')}
              >
                <option value="PUBLIC">Public</option>
                <option value="CAMPUS">Campus</option>
                <option value="PRIVATE">Private</option>
              </select>
            </label>
            <label className="flex items-center gap-3 self-end rounded-xl border border-line px-4 py-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" {...form.register('registrationRequired')} /> Registration
              required
            </label>
          </div>
          {registrationRequired ? <Field
            label="External registration URL"
            placeholder="https://forms.google.com/..."
            error={form.formState.errors.registrationUrl?.message}
            {...form.register('registrationUrl')}
          /> : <p className="rounded-xl bg-[var(--surface-secondary)] px-4 py-3 text-sm text-muted">No registration required. Attendees can view the event without signing up.</p>}
          {!clubId ? <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Related Team ID (optional)"
              placeholder="MongoDB team id"
              {...form.register('teamId')}
            />
            <Field
              label="Related Community ID (optional)"
              placeholder="MongoDB community id"
              {...form.register('communityId')}
            />
          </div> : null}
          {mutation.error ? (
            <ErrorState message={apiErrorMessage(mutation.error, 'Event could not be created.')} />
          ) : null}
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Creating event...' : 'Create event'}
          </Button>
        </form>
      </Card>
    </CreateResourceLayout>
  );
}
