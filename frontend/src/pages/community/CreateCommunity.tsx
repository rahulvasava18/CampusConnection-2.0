import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createCommunity } from '../../features/community/community.api';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const communityCategories = [
  'Technology',
  'Design',
  'Academic',
  'Sports',
  'Clubs',
  'Entrepreneurship',
] as const;

const communityCreateSchema = z.object({
  name: z.string().trim().min(2, 'Community name is required.').max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1, 'Community category is required.').max(80),
  privacy: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
});

type CommunityCreateForm = z.infer<typeof communityCreateSchema>;

export function CreateCommunity({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CommunityCreateForm>({
    resolver: zodResolver(communityCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'Technology',
      privacy: 'PUBLIC',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: CommunityCreateForm) =>
      createCommunity({
        name: input.name.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        category: input.category.trim(),
        privacy: input.privacy,
      }),
    onSuccess: (community) => {
      void queryClient.invalidateQueries({ queryKey: ['communities'] });
      onNavigate(`/communities/${community.id}`);
    },
  });

  return (
    <CreateResourceLayout
      eyebrow="Communities / Create"
      title="Create a community"
      description="Give your community a place to grow."
      backLabel="Communities"
      onBack={() => onNavigate('/communities')}
    >
      <Card className="p-5 sm:p-7">
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
        >
          <Field
            label="Community name"
            placeholder="AI & Machine Learning"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Category
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              {...form.register('category')}
            >
              {communityCategories.map((category) => (
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
          <TextareaField
            label="Description"
            placeholder="What will members discuss here?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Visibility
            <select
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
              {...form.register('privacy')}
            >
              <option value="PUBLIC">Public - discoverable by everyone</option>
              <option value="CAMPUS">Campus - visible to campus members</option>
              <option value="PRIVATE">Private - membership required</option>
            </select>
          </label>
          {mutation.error ? (
            <ErrorState
              message={apiErrorMessage(mutation.error, 'Community could not be created.')}
            />
          ) : null}
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Creating community...' : 'Create community'}
          </Button>
        </form>
      </Card>
    </CreateResourceLayout>
  );
}
