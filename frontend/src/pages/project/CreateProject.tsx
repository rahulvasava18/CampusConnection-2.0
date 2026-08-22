import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createProject, getTeams } from '../../features/collaboration/collaboration.api';
import { collectionItems, apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required.').max(140),
  description: z.string().trim().max(2500).optional(),
  category: z.string().trim().min(1, 'Project category is required.').max(80),
  lookingFor: z.string().optional(),
  teamId: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
});

type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export function CreateProject({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'Technology',
      lookingFor: '',
      teamId: '',
      visibility: 'PUBLIC',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: ProjectCreateInput) =>
      createProject({
        name: input.name,
        description: input.description ?? '',
        category: input.category,
        lookingFor: (input.lookingFor ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(input.teamId ? { teamId: input.teamId } : {}),
        visibility: input.visibility,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      onNavigate('/projects');
    },
  });

  return (
    <CreateResourceLayout
      eyebrow="Workspace / Projects / Create"
      title="Create a project"
      description="Turn an idea into something people can build together."
      backLabel="Projects"
      onBack={() => onNavigate('/projects')}
    >
      <Card className="p-5 sm:p-7">
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
        >
          <Field
            label="Project name"
            placeholder="Campus marketplace"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextareaField
            label="Description (optional)"
            placeholder="What are you building?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <Field
            label="Category"
            placeholder="AI, education, marketplace"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
          <Field
            label="Looking for (optional)"
            placeholder="ML engineer, designer"
            {...form.register('lookingFor')}
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Associated Team (optional)
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink"
              {...form.register('teamId')}
            >
              <option value="">No associated team</option>
              {collectionItems(teams.data).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Visibility
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              {...form.register('visibility')}
            >
              <option value="PUBLIC">Public - discoverable by everyone</option>
              <option value="CAMPUS">Campus - visible to campus members</option>
              <option value="PRIVATE">Private - invitation only</option>
            </select>
          </label>
          {mutation.error ? (
            <ErrorState message={apiErrorMessage(mutation.error, 'Project could not be created.')} />
          ) : null}
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Creating project...' : 'Create project'}
          </Button>
        </form>
      </Card>
    </CreateResourceLayout>
  );
}
