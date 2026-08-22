import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createTeam } from '../../features/collaboration/collaboration.api';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const teamCreateSchema = z.object({
  name: z.string().trim().min(2, 'Team name is required.').max(120),
  category: z.string().trim().min(1, 'Team category is required.').max(80),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
});

type TeamCreateInput = z.input<typeof teamCreateSchema>;
type TeamCreateForm = z.output<typeof teamCreateSchema>;
const teamCategories = ['Hackathon', 'Project', 'Competition', 'Research', 'Startup', 'Study group'];

export function CreateTeam({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<TeamCreateInput, unknown, TeamCreateForm>({
    resolver: zodResolver(teamCreateSchema),
    defaultValues: {
      name: '',
      category: 'Hackathon',
      visibility: 'PUBLIC',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: TeamCreateForm) => {
      return createTeam(input);
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
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Category
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              {...form.register('category')}
            >
              {teamCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {form.formState.errors.category?.message ? (
              <span className="text-xs font-medium text-red-600">
                {form.formState.errors.category.message}
              </span>
            ) : null}
          </label>
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
