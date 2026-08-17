import { useState } from 'react';
import { ArrowLeft, LoaderCircle, MessageCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ReplyCard } from './components/ReplyCard';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  TextareaField,
} from '../../components/ui';
import { getDiscussion, getReplies, createReply } from '../../features/community/community.api';
import { apiErrorMessage, collectionItems } from '../../lib/api-state';

export function DiscussionDetail({
  discussionId,
  onNavigate,
}: {
  discussionId: string;
  onNavigate: (path: string) => void;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const discussion = useQuery({
    queryKey: ['discussion', discussionId],
    queryFn: () => getDiscussion(discussionId),
  });
  const replies = useQuery({
    queryKey: ['discussion-replies', discussionId],
    queryFn: () => getReplies(discussionId),
    enabled: Boolean(discussion.data),
  });
  const reply = useMutation({
    mutationFn: () => createReply(discussionId, content),
    onSuccess: () => {
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['discussion-replies', discussionId] });
      void queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      void queryClient.invalidateQueries({
        queryKey: ['community-discussions', discussion.data?.communityId],
      });
    },
  });
  if (discussion.isLoading) return <LoadingState label="Opening discussion" />;
  if (discussion.error || !discussion.data)
    return <ErrorState message={apiErrorMessage(discussion.error, 'Discussion not found.')} />;
  const replyItems = collectionItems(replies.data);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button
        type="button"
        onClick={() => onNavigate(`/communities/${discussion.data.communityId}`)}
        className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to community
      </button>
      <Card className="p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{discussion.data.type}</Badge>
          <span className="text-xs text-muted">by {discussion.data.author.displayName}</span>
        </div>
        <h1 className="type-display mt-4 text-3xl font-bold text-ink">{discussion.data.title}</h1>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {discussion.data.content}
        </p>
        <div className="mt-6 flex items-center gap-2 border-t border-line pt-4 text-sm font-semibold text-muted">
          <MessageCircle className="h-4 w-4 text-brand-600" /> {discussion.data.replyCount} replies
        </div>
      </Card>
      <Card className="p-5 sm:p-7">
        <h2 className="type-display text-xl font-bold text-ink">Replies</h2>
        {replies.isLoading ? <LoadingState label="Loading replies" /> : null}
        {replies.error ? (
          <ErrorState message={apiErrorMessage(replies.error, 'Replies could not be loaded.')} />
        ) : null}
        {!replies.isLoading && !replies.error && replyItems.length === 0 ? (
          <EmptyState
            title="No replies yet"
            description="Be the first person to add a thoughtful reply."
          />
        ) : null}
        <div className="mt-3">
          {replyItems.map((item) => (
            <ReplyCard key={item.id} reply={item} />
          ))}
        </div>
        <form
          className="mt-5 grid gap-3 border-t border-line pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            reply.mutate();
          }}
        >
          <TextareaField
            label="Write a reply"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Add something useful to the conversation..."
            required
          />
          {reply.error ? (
            <ErrorState message={apiErrorMessage(reply.error, 'Reply could not be posted.')} />
          ) : null}
          <Button type="submit" disabled={reply.isPending || !content.trim()}>
            {reply.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {reply.isPending ? 'Posting...' : 'Reply'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
