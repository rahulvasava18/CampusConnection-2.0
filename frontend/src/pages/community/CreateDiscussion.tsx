import { useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  ErrorState,
  Field,
  SectionHeading,
  TextareaField,
} from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import { createDiscussion, getCommunity } from '../../features/community/community.api';

export function CreateDiscussion({
  communityId,
  onNavigate,
}: {
  communityId: string;
  onNavigate: (path: string) => void;
}) {
  const community = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => getCommunity(communityId),
  });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'QUESTION' | 'DISCUSSION' | 'RESOURCE'>('DISCUSSION');
  const mutation = useMutation({
    mutationFn: () => createDiscussion(communityId, { title, content, type, tags: [] }),
    onSuccess: (discussion) => onNavigate(`/discussions/${discussion.id}`),
  });
  if (community.isLoading) return <p className="text-sm text-muted">Loading community...</p>;
  if (community.error || !community.data)
    return <ErrorState message={apiErrorMessage(community.error, 'Community not found.')} />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => onNavigate(`/communities/${communityId}`)}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> {community.data.name}
      </button>
      <SectionHeading
        eyebrow="New discussion"
        title="Start the conversation."
        description="Ask a question, share a resource, or open a thoughtful discussion."
      />
      <Card className="p-5 sm:p-7">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Field
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What are you learning this week?"
            required
          />
          <TextareaField
            label="Content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add context for the community..."
            required
          />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              className="min-h-11 rounded-[10px] border border-line bg-white px-3.5 text-sm font-normal text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-100"
            >
              <option value="DISCUSSION">Discussion</option>
              <option value="QUESTION">Question</option>
              <option value="RESOURCE">Resource</option>
            </select>
          </label>
          {mutation.error ? (
            <ErrorState
              message={apiErrorMessage(mutation.error, 'Discussion could not be created.')}
            />
          ) : null}
          <Button
            type="submit"
            size="lg"
            disabled={mutation.isPending || !title.trim() || !content.trim()}
          >
            {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Publishing...' : 'Publish discussion'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
