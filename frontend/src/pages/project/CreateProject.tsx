import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createProject, getTeams } from '../../features/collaboration/collaboration.api';
import { collectionItems } from '../../lib/api-state';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

function optionalUrl() {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url('Enter a valid URL.').max(500).optional(),
  );
}

const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required.').max(140),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Slug must be at least 3 characters.')
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.'),
  description: z.string().trim().min(1, 'Project description is required.').max(2500),
  objective: z.string().trim().min(1, 'Project objective is required.').max(1500),
  category: z.string().trim().min(1, 'Project category is required.').max(80),
  tags: z.string().optional(),
  lookingFor: z.string().optional(),
  deadline: z.string().optional(),
  teamId: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  technologies: z.string().optional(),
  repositoryUrl: optionalUrl(),
  demoUrl: optionalUrl(),
});

type ProjectCreateInput = z.input<typeof projectCreateSchema>;
type ProjectCreateForm = z.output<typeof projectCreateSchema>;

export function CreateProject({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const form = useForm<ProjectCreateInput, unknown, ProjectCreateForm>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      objective: '',
      category: 'Technology',
      tags: '',
      lookingFor: '',
      deadline: '',
      teamId: '',
      visibility: 'PUBLIC',
      technologies: '',
      repositoryUrl: '',
      demoUrl: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: ProjectCreateForm) => {
      const { technologies, tags, lookingFor, deadline, teamId, ...base } = input;
      return createProject({
        ...base,
        technologies: (technologies ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        tags: (tags ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        lookingFor: (lookingFor ?? '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(deadline ? { deadline: new Date(`${deadline}T23:59:59.000Z`).toISOString() } : {}),
        ...(teamId ? { teamId } : {}),
      });
    },
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
          <Field
            label="Slug"
            placeholder="campus-marketplace"
            error={form.formState.errors.slug?.message}
            {...form.register('slug')}
          />
          <TextareaField
            label="Description"
            placeholder="What are you building?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <TextareaField
            label="Objective"
            placeholder="What outcome will this project deliver?"
            error={form.formState.errors.objective?.message}
            {...form.register('objective')}
          />
          <Field
            label="Category"
            placeholder="AI, education, marketplace"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
          <Field
            label="Tags (comma separated, optional)"
            placeholder="AI, campus, navigation"
            {...form.register('tags')}
          />
          <Field
            label="Technologies (comma separated, optional)"
            placeholder="React, TypeScript, MongoDB"
            error={form.formState.errors.technologies?.message}
            {...form.register('technologies')}
          />
          <Field
            label="Looking for (comma separated, optional)"
            placeholder="ML engineer, designer"
            {...form.register('lookingFor')}
          />
          <Field label="Deadline (optional)" type="date" {...form.register('deadline')} />
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
          <Field
            label="Repository URL (optional)"
            type="url"
            placeholder="https://github.com/..."
            error={form.formState.errors.repositoryUrl?.message}
            {...form.register('repositoryUrl')}
          />
          <Field
            label="Demo URL (optional)"
            type="url"
            placeholder="https://..."
            error={form.formState.errors.demoUrl?.message}
            {...form.register('demoUrl')}
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
            <ErrorState
              message={apiErrorMessage(mutation.error, 'Project could not be created.')}
            />
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
