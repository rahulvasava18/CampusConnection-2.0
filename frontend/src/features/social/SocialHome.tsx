import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '../auth/auth.store';
import { getFeed } from './social.api';
import { PostCard } from './components/PostCard';
import { Button, EmptyState, ErrorState, RestrictedState } from '../../components/ui';
import { apiErrorMessage, isRestrictedApiError, paginatedItems } from '../../lib/api-state';
import { AdminReportDialog } from '../../pages/admin/AdminReportDialog';

export function SocialHome({ onNavigate }: { onNavigate?: (target: string) => void }) {
  const [reportTarget, setReportTarget] = useState<{ type: 'POST' | 'COMMENT'; id: string } | null>(null);
  const feed = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => getFeed(pageParam, 'chronological'),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
  });
  const accountState = useAuthStore((state) => state.user?.accountState);
  const socialAccessRestricted = accountState !== 'ACTIVE';
  const feedItems = paginatedItems(feed.data?.pages);

  return (
    <section className="space-y-5">
      {feed.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted">Loading your feed…</div>
      ) : null}
      {socialAccessRestricted || isRestrictedApiError(feed.error) ? (
        <RestrictedState message="Verify your email before using the campus feed. Your signed-in session remains active." />
      ) : feed.error ? (
        <ErrorState
          message={apiErrorMessage(feed.error, 'Unable to load the feed.')}
          onRetry={() => void feed.refetch()}
        />
      ) : null}
      {!socialAccessRestricted && !feed.isLoading && !feed.error && !feedItems.length ? (
        <EmptyState
          title="Your feed is ready for its first update"
          description="Share what you are learning, building, or looking for with your campus."
        />
      ) : null}
      <div className="grid gap-4">
        {feedItems.map((item) => (
          <PostCard
            key={item.id}
            post={item}
            {...(onNavigate ? { onNavigate } : {})}
            onReport={() => setReportTarget({ type: 'POST', id: item.id })}
            onReportComment={(commentId) => setReportTarget({ type: 'COMMENT', id: commentId })}
          />
        ))}
      </div>
      {feed.hasNextPage ? (
        <Button
          variant="secondary"
          onClick={() => void feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
          className="w-full"
        >
          {feed.isFetchingNextPage ? 'Loading…' : 'Load more updates'}
        </Button>
      ) : null}
      {reportTarget ? <AdminReportDialog open targetType={reportTarget.type} targetId={reportTarget.id} onClose={() => setReportTarget(null)} /> : null}
    </section>
  );
}
