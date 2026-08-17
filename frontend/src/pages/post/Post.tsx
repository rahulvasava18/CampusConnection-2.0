import { useEffect, useState } from 'react';
import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiCollection, PostType, SocialPostView } from '@campusconnection/shared';
import { z } from 'zod';
import { createPost } from '../../features/social/social.api';
import { useAuthStore } from '../../features/auth/auth.store';
import { apiErrorMessage } from '../../lib/api-state';
import {
  Button,
  Card,
  ErrorState,
  Field,
  RestrictedState,
  TextareaField,
} from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';

const postTypes = [
  'GENERAL',
  'DISCUSSION',
  'QUESTION',
  'IDEA',
  'OPPORTUNITY',
  'ANNOUNCEMENT',
] as const;
const defaultPostType: PostType = 'GENERAL';
const draftKey = 'campusconnection:post-draft';
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxImages = 4;
const maxImageBytes = 8 * 1024 * 1024;

const postFormSchema = z.object({
  content: z.string().trim().min(1, 'Write something before publishing.').max(5000),
  type: z.enum(postTypes),
  tags: z.string().max(400).optional(),
  link: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Enter a valid http(s) link.')
    .optional(),
  visibility: z.enum(['PUBLIC', 'CAMPUS', 'CONNECTIONS']),
});

type PostForm = z.infer<typeof postFormSchema>;
type FeedCache = { pages: ApiCollection<SocialPostView>[]; pageParams: unknown[] };

function topicsFromInput(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean),
    ),
  ].slice(0, 10);
}

function draftValues(): Partial<PostForm> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(draftKey) ?? '{}') as Partial<PostForm>;
    return {
      ...(typeof parsed.content === 'string' ? { content: parsed.content } : {}),
      ...(typeof parsed.tags === 'string' ? { tags: parsed.tags } : {}),
      ...(typeof parsed.link === 'string' ? { link: parsed.link } : {}),
      ...(postTypes.includes(parsed.type as PostType) ? { type: parsed.type } : {}),
      ...(parsed.visibility === 'PUBLIC' ||
      parsed.visibility === 'CAMPUS' ||
      parsed.visibility === 'CONNECTIONS'
        ? { visibility: parsed.visibility }
        : {}),
    };
  } catch {
    return {};
  }
}

export function Post({
  onNavigate,
  communityId,
  communityName,
  onPublished,
}: {
  onNavigate: (target: string) => void;
  communityId?: string;
  communityName?: string;
  onPublished?: () => void;
}) {
  const queryClient = useQueryClient();
  const accountState = useAuthStore((state) => state.user?.accountState);
  const [media, setMedia] = useState<Array<{ file: File; preview: string }>>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const postForm = useForm<PostForm>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { content: '', type: defaultPostType, tags: '', link: '', visibility: 'PUBLIC' },
  });
  const restricted = accountState !== 'ACTIVE';

  useEffect(() => {
    postForm.reset({
      content: '',
      type: defaultPostType,
      tags: '',
      link: '',
      visibility: 'PUBLIC',
      ...draftValues(),
    });
  }, [postForm]);

  useEffect(() => {
    const subscription = postForm.watch((value) => {
      if (typeof window === 'undefined') return;
      const hasDraft = Boolean(value.content?.trim() || value.tags?.trim() || value.link?.trim());
      if (hasDraft) localStorage.setItem(draftKey, JSON.stringify(value));
      else localStorage.removeItem(draftKey);
    });
    return () => subscription.unsubscribe();
  }, [postForm]);

  const post = useMutation({
    mutationFn: (input: PostForm) =>
      createPost({
        type: input.type,
        content: input.content,
        visibility: input.visibility,
        tags: topicsFromInput(input.tags),
        ...(input.link?.trim() ? { link: input.link.trim() } : {}),
        ...(communityId ? { communityId } : {}),
        ...(media.length ? { media: media.map((item) => item.file) } : {}),
      }),
    onSuccess: (created) => {
      const current = queryClient.getQueryData<FeedCache>(['feed']);
      if (current?.pages[0]) {
        queryClient.setQueryData<FeedCache>(['feed'], {
          ...current,
          pages: [
            { ...current.pages[0], data: [created, ...current.pages[0].data] },
            ...current.pages.slice(1),
          ],
        });
      } else {
        queryClient.setQueryData<FeedCache>(['feed'], {
          pages: [{ data: [created], pagination: { hasMore: false, nextCursor: null } }],
          pageParams: [undefined],
        });
      }
      if (typeof window !== 'undefined') localStorage.removeItem(draftKey);
      media.forEach((item) => URL.revokeObjectURL(item.preview));
      setMedia([]);
      postForm.reset({
        content: '',
        type: defaultPostType,
        tags: '',
        link: '',
        visibility: 'PUBLIC',
      });
      if (onPublished) onPublished();
      else onNavigate('home');
    },
  });

  const addMedia = (files: FileList | null) => {
    if (!files) return;
    setMediaError(null);
    const selected = Array.from(files);
    if (media.length + selected.length > maxImages) {
      setMediaError('You can attach up to 4 images.');
      return;
    }
    const invalid = selected.find(
      (file) => !allowedImageTypes.has(file.type) || file.size > maxImageBytes,
    );
    if (invalid) {
      setMediaError(
        invalid.size > maxImageBytes
          ? 'That image is too large. Choose a smaller image.'
          : "That image type isn't supported.",
      );
      return;
    }
    setMedia((current) => [
      ...current,
      ...selected.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        eyebrow={communityName ? `Community / ${communityName}` : 'Workspace / Post'}
        title={communityName ? `Share with ${communityName}.` : 'Share with your campus.'}
        description={
          communityName
            ? 'Start a conversation with this community.'
            : 'Start a conversation, ask a question, or share what you are building.'
        }
      />
      {restricted ? (
        <RestrictedState message="Verify your email before publishing to the campus feed." />
      ) : null}
      <Card className="rounded-[1.25rem] p-5 shadow-[0_8px_24px_rgba(32,55,59,.06)] sm:p-6">
        <form
          className="grid gap-5"
          onSubmit={postForm.handleSubmit((input) => post.mutate(input))}
        >
          <TextareaField
            label="Share something with your campus"
            aria-label="Post content"
            {...postForm.register('content')}
            placeholder="What are you working on?"
            maxLength={5000}
            error={postForm.formState.errors.content?.message}
            disabled={restricted}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Post type
              <select
                aria-label="Post type"
                {...postForm.register('type')}
                disabled={restricted}
                className="min-h-11 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-400"
              >
                {postTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Visibility
              <select
                aria-label="Visibility"
                {...postForm.register('visibility')}
                disabled={restricted}
                className="min-h-11 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-brand-400"
              >
                <option value="PUBLIC">Public</option>
                <option value="CAMPUS">Campus</option>
                <option value="CONNECTIONS">Connections</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Topics (comma separated, optional)"
              placeholder="React, Machine Learning"
              {...postForm.register('tags')}
              disabled={restricted}
            />
            <Field
              label="Link (optional)"
              type="url"
              placeholder="https://example.com"
              error={postForm.formState.errors.link?.message}
              {...postForm.register('link')}
              disabled={restricted}
            />
          </div>
          <div className="grid gap-3">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              <ImagePlus className="h-4 w-4 text-brand-600" />
              Add images
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                aria-label="Add post images"
                onChange={(event) => {
                  addMedia(event.target.files);
                  event.target.value = '';
                }}
                disabled={restricted || post.isPending}
              />
            </label>
            {mediaError ? <p className="text-sm text-red-600">{mediaError}</p> : null}
            {media.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {media.map((item, index) => (
                  <div
                    className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"
                    key={item.preview}
                  >
                    <img
                      src={item.preview}
                      alt={`Selected upload ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() => {
                        URL.revokeObjectURL(item.preview);
                        setMedia((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        );
                      }}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-600 shadow hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {post.error ? (
            <ErrorState
              message={apiErrorMessage(
                post.error,
                "Couldn't publish your post. Check your connection and try again.",
              )}
            />
          ) : null}
          <Button type="submit" className="sm:ml-auto" disabled={restricted || post.isPending}>
            {post.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {post.isPending ? 'Publishing...' : 'Publish update'}
          </Button>
        </form>
      </Card>
    </section>
  );
}
