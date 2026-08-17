import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createCommunity } from '../../features/community/community.api';
import { apiErrorMessage } from '../../lib/api-state';
import { Button, Card, ErrorState, Field, TextareaField } from '../../components/ui';
import { CreateResourceLayout } from '../_shared/CreateResourceLayout';

const communityCreateSchema = z.object({
  name: z.string().trim().min(2, 'Community name is required.').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Slug must be at least 3 characters.')
    .max(90)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens.'),
  description: z.string().trim().min(1, 'Community description is required.').max(1000),
  category: z.string().trim().min(1, 'Community category is required.').max(80),
  privacy: z.enum(['PUBLIC', 'CAMPUS', 'PRIVATE']),
  tags: z.string().optional(),
  rules: z.string().optional(),
  avatarUrl: z.string().url('Use a valid image URL.').optional().or(z.literal('')),
  bannerUrl: z.string().url('Use a valid image URL.').optional().or(z.literal('')),
});

type CommunityCreateForm = z.infer<typeof communityCreateSchema>;

export function CreateCommunity({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const form = useForm<CommunityCreateForm>({
    resolver: zodResolver(communityCreateSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      category: 'Technology',
      privacy: 'PUBLIC',
      tags: '',
      rules: '',
      avatarUrl: '',
      bannerUrl: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (input: CommunityCreateForm) => {
      const { tags, rules, avatarUrl, bannerUrl, ...base } = input;
      return createCommunity({
        ...base,
        ...(avatarUrl?.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        ...(bannerUrl?.trim() ? { bannerUrl: bannerUrl.trim() } : {}),
        ...(tags?.trim()
          ? {
              tags: tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            }
          : {}),
        ...(rules?.trim()
          ? {
              rules: rules
                .split('\n')
                .map((rule) => rule.trim())
                .filter(Boolean),
            }
          : {}),
      });
    },
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
          <Field
            label="Slug"
            placeholder="ai-machine-learning"
            error={form.formState.errors.slug?.message}
            {...form.register('slug')}
          />
          <Field
            label="Category"
            placeholder="Technology"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
          <TextareaField
            label="Description"
            placeholder="What will members discuss here?"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <Field
            label="Tags (comma separated)"
            placeholder="AI, Python, Research"
            {...form.register('tags')}
          />
          <TextareaField
            label="Rules (one per line)"
            placeholder="Be respectful\nKeep discussions relevant"
            {...form.register('rules')}
          />
          <Field
            label="Avatar image URL (optional)"
            placeholder="https://..."
            error={form.formState.errors.avatarUrl?.message}
            {...form.register('avatarUrl')}
          />
          <Field
            label="Cover image URL (optional)"
            placeholder="https://..."
            error={form.formState.errors.bannerUrl?.message}
            {...form.register('bannerUrl')}
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
