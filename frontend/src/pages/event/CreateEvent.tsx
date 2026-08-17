import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createEvent } from '../../features/collaboration/collaboration.api';
import { useAuthStore } from '../../features/auth/auth.store';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
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
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  rules: z.string().optional(),
  teamId: z.string().optional(),
  communityId: z.string().optional(),
});

type EventFormInput = z.input<typeof eventCreateSchema>;
type EventForm = z.output<typeof eventCreateSchema>;
const toIso = (value: string) => new Date(value).toISOString();

export function CreateEvent({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
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
      visibility: 'PUBLIC',
      rules: '',
      teamId: '',
      communityId: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: EventForm) => {
      const { tags, coverImageUrl, registrationDeadline, rules, teamId, communityId, ...base } =
        input;
      return createEvent({
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
        ...(registrationDeadline ? { registrationDeadline: toIso(registrationDeadline) } : {}),
        ...(teamId?.trim() ? { teamId: teamId.trim() } : {}),
        ...(communityId?.trim() ? { communityId: communityId.trim() } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      onNavigate('/events');
    },
  });

  return (
    <CreateResourceLayout
      eyebrow="Workspace / Events / Create"
      title="Create an event"
      description="Bring your campus together with a clear, well-organized event."
      backLabel="Events"
      onBack={() => onNavigate('/events')}
    >
      <Card className="p-5 sm:p-7">
        <div className="mb-5 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
          <strong>Organizer:</strong> {user?.displayName ?? 'Your account'}{' '}
          {user?.username ? `(@${user.username})` : ''}
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
            <Field
              label="Registration deadline (optional)"
              type="datetime-local"
              {...form.register('registrationDeadline')}
            />
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
          <div className="grid gap-5 sm:grid-cols-2">
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
          </div>
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
