import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecommendationItem } from '@campusconnection/shared';
import { ArrowUpRight, CalendarDays, Check, Sparkles, UserRound, X } from 'lucide-react';
import {
  getRecommendations,
  sendRecommendationFeedback,
} from '../../../features/intelligence/intelligence.api';
import { requestConnection } from '../../../features/social/social.api';
import { Avatar, Badge, Button, Card, ErrorState, Skeleton } from '../../../components/ui';
import { apiErrorMessage, isRestrictedApiError, paginatedItems } from '../../../lib/api-state';

type HomeNavigation = (target: string) => void;

function RailHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof UserRound;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
      <div>
        <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
          {eyebrow}
        </p>
        <h2 className="type-display mt-1 text-lg font-bold text-ink">{title}</h2>
      </div>
      <span className="rounded-xl bg-brand-50 p-2 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}

function RecommendationSkeleton({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-label="Loading recommendations">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center gap-3" key={index}>
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function recommendationMeta(item: RecommendationItem): string {
  const metadata = item.target.metadata;
  const username = typeof metadata.username === 'string' ? `@${metadata.username}` : undefined;
  const college = typeof metadata.college === 'string' ? metadata.college : undefined;
  const status = typeof metadata.status === 'string' ? metadata.status.toLowerCase() : undefined;
  return username ?? college ?? status ?? item.target.type.toLowerCase();
}

function recommendationRoute(item: RecommendationItem): string {
  if (item.target.type === 'TEAM') return 'teams';
  if (item.target.type === 'PROJECT') return 'projects';
  if (item.target.type === 'COMMUNITY') return 'communities';
  return 'search';
}

function PostEntry({ onNavigate }: { onNavigate: HomeNavigation }) {
  return (
    <Card
      className="cursor-pointer rounded-[1.25rem] p-4 shadow-[0_8px_24px_rgba(19,70,134,.06)] transition hover:border-brand-200 hover:shadow-md sm:p-5"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate('post')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onNavigate('post');
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="type-ui truncate text-sm font-bold text-ink">What are you working on?</p>
          <p className="mt-1 truncate text-sm text-muted">Will you share something...</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate('post');
          }}
        >
          Post <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

function PeopleSuggestions({ onNavigate }: { onNavigate: HomeNavigation }) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const people = useInfiniteQuery({
    queryKey: ['home-recommendations', 'PEOPLE'],
    queryFn: ({ pageParam }) => getRecommendations('PEOPLE', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
  });
  const connect = useMutation({
    mutationFn: (item: RecommendationItem) => requestConnection(item.targetId),
    onMutate: (item) => setPendingAction(item.id),
    onSettled: () => setPendingAction(null),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['home-recommendations', 'PEOPLE'] }),
  });
  const dismiss = useMutation({
    mutationFn: (item: RecommendationItem) =>
      sendRecommendationFeedback(item.targetId, item.type, 'DISMISS'),
    onMutate: (item) => setPendingAction(item.id),
    onSettled: () => setPendingAction(null),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['home-recommendations', 'PEOPLE'] }),
  });
  const items = paginatedItems(people.data?.pages).slice(0, 3);

  return (
    <Card className="p-4 sm:p-5">
      <RailHeader icon={UserRound} eyebrow="People" title="Suggested for you" />
      <div className="mt-5">
        {people.isLoading ? <RecommendationSkeleton count={3} /> : null}
        {isRestrictedApiError(people.error) ? (
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
            Verify your email to unlock people suggestions.
          </p>
        ) : null}
        {people.error && !isRestrictedApiError(people.error) ? (
          <ErrorState
            message={apiErrorMessage(people.error, 'People suggestions are unavailable.')}
            onRetry={() => void people.refetch()}
          />
        ) : null}
        {!people.isLoading && !people.error && !items.length ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm leading-6 text-muted">
            No new people suggestions yet.
          </p>
        ) : null}
        <div className="space-y-4">
          {items.map((item) => {
            const isPending = pendingAction === item.id;
            return (
              <div className="flex items-center gap-3" key={item.id}>
                <Avatar name={item.target.title} src={item.target.imageUrl} size="md" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onNavigate('search')}
                >
                  <span className="block truncate text-sm font-bold text-ink">
                    {item.target.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {recommendationMeta(item)}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => connect.mutate(item)}
                    disabled={isPending}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Connect
                  </Button>
                  <button
                    type="button"
                    aria-label={`Dismiss ${item.target.title}`}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
                    onClick={() => dismiss.mutate(item)}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className="type-ui mt-5 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-800"
        onClick={() => onNavigate('search')}
      >
        Explore people <ArrowUpRight className="h-4 w-4" />
      </button>
    </Card>
  );
}

function UpcomingEvent({ onNavigate }: { onNavigate: HomeNavigation }) {
  return (
    <Card className="p-4 sm:p-5">
      <RailHeader icon={CalendarDays} eyebrow="Upcoming" title="Next on campus" />
      <div className="mt-5 rounded-xl border border-dashed border-line-strong bg-slate-50/70 px-4 py-5">
        <CalendarDays className="h-5 w-5 text-brand-500" />
        <p className="mt-3 text-sm font-bold text-ink">No upcoming events</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Events will appear here when your campus calendar has something new.
        </p>
      </div>
      <Button size="sm" variant="ghost" className="mt-3 px-0" onClick={() => onNavigate('events')}>
        Explore events <ArrowUpRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}

function ForYou({ onNavigate }: { onNavigate: HomeNavigation }) {
  const recommendations = useInfiniteQuery({
    queryKey: ['home-recommendations', 'PROJECTS'],
    queryFn: ({ pageParam }) => getRecommendations('PROJECTS', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: () => undefined,
  });
  const item = paginatedItems(recommendations.data?.pages)[0];

  return (
    <Card className="p-4 sm:p-5">
      <RailHeader icon={Sparkles} eyebrow="For you" title="A thoughtful next step" />
      <div className="mt-5">
        {recommendations.isLoading ? <RecommendationSkeleton /> : null}
        {isRestrictedApiError(recommendations.error) ? (
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
            Verify your email to unlock personalized ideas.
          </p>
        ) : null}
        {recommendations.error && !isRestrictedApiError(recommendations.error) ? (
          <ErrorState
            message={apiErrorMessage(recommendations.error, 'Recommendations are unavailable.')}
            onRetry={() => void recommendations.refetch()}
          />
        ) : null}
        {!recommendations.isLoading && !recommendations.error && !item ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm leading-6 text-muted">
            Your next recommendation is taking shape.
          </p>
        ) : null}
        {item ? (
          <>
            <div className="flex items-start gap-3">
              <Avatar
                name={item.target.title}
                src={item.target.imageUrl}
                size="lg"
                className="rounded-xl"
              />
              <div className="min-w-0">
                <Badge tone="brand">{item.target.type.toLowerCase()}</Badge>
                <h3 className="mt-2 line-clamp-2 text-sm font-bold text-ink">
                  {item.target.title}
                </h3>
              </div>
            </div>
            {item.target.description ? (
              <p className="mt-4 text-sm leading-6 text-muted">{item.target.description}</p>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => onNavigate(recommendationRoute(item))}
            >
              Open recommendation <ArrowUpRight className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

export function HomeRightRail({ onNavigate }: { onNavigate: HomeNavigation }) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-24">
      <PostEntry onNavigate={onNavigate} />
      <PeopleSuggestions onNavigate={onNavigate} />
      <UpcomingEvent onNavigate={onNavigate} />
      <ForYou onNavigate={onNavigate} />
    </aside>
  );
}
