import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createTeam } from '../../features/collaboration/collaboration.api';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const teamCreateSchema = z.object({
  name: z.string().trim().min(2, 'Team name is required.').max(120),
  description: z.string().trim().min(1, 'Team description is required.').max(1500),
  goal: z.string().trim().min(1, 'Team goal is required.').max(1500),
  category: z.string().trim().min(1, 'Team category is required.').max(80),
  tags: z.string().optional(),
  lookingFor: z.string().optional(),
  avatarUrl: z.string().url('Use a valid image URL.').optional().or(z.literal('')),
  deadline: z.string().optional(),
  maxMembers: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(100).optional(),
  ),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
});

type TeamCreateInput = z.input<typeof teamCreateSchema>;
type TeamCreateForm = z.output<typeof teamCreateSchema>;

export function CreateTeam({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<TeamCreateInput, unknown, TeamCreateForm>({
    resolver: zodResolver(teamCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      goal: '',
      category: 'Hackathon',
      tags: '',
      lookingFor: '',
      avatarUrl: '',
      deadline: '',
      maxMembers: undefined,
      visibility: 'PUBLIC',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: TeamCreateForm) => {
      const { tags, lookingFor, avatarUrl, deadline, ...base } = input;
      return createTeam({
        ...base,
        tags:
          tags
            ?.split(',')
            .map((item) => item.trim())
            .filter(Boolean) ?? [],
        lookingFor:
          lookingFor
            ?.split(',')
            .map((item) => item.trim())
            .filter(Boolean) ?? [],
        ...(avatarUrl?.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59.000Z`).toISOString() } : {}),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teams'] });
      onNavigate('/teams');
    },
  });

  return (
    <CreateResourceLayout
      eyebrow="Workspace / Teams / Create"
      title="Create a team"
      description="Bring the right people together."
      backLabel="Teams"
      onBack={() => onNavigate('/teams')}
    >
      <Card className="p-5 sm:p-7">
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
        >
          <Field
            label="Team name"
            placeholder="Campus builders"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextareaField
            label="Description"
            placeholder="What is your team building together?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <TextareaField
            label="Goal"
            placeholder="What will this team accomplish?"
            error={form.formState.errors.goal?.message}
            {...form.register('goal')}
          />
          <Field
            label="Category"
            placeholder="Hackathon, project, competition"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
          <Field
            label="Tags (comma separated)"
            placeholder="AI, React, Node.js"
            {...form.register('tags')}
          />
          <Field
            label="Looking for (comma separated)"
            placeholder="Backend developer, ML engineer"
            {...form.register('lookingFor')}
          />
          <Field label="Deadline (optional)" type="date" {...form.register('deadline')} />
          <Field
            label="Avatar image URL (optional)"
            placeholder="https://..."
            error={form.formState.errors.avatarUrl?.message}
            {...form.register('avatarUrl')}
          />
          <Field
            label="Maximum members (optional)"
            type="number"
            min={1}
            max={100}
            placeholder="10"
            error={form.formState.errors.maxMembers?.message}
            {...form.register('maxMembers')}
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Visibility
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              {...form.register('visibility')}
            >
              <option value="PUBLIC">Public - discoverable by everyone</option>
              <option value="CAMPUS">Campus - visible to campus members</option>
              <option value="PRIVATE">Private - membership required</option>
            </select>
          </label>
          {mutation.error ? (
            <ErrorState message={apiErrorMessage(mutation.error, 'Team could not be created.')} />
          ) : null}
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Creating team...' : 'Create team'}
          </Button>
        </form>
      </Card>
    </CreateResourceLayout>
  );
}
