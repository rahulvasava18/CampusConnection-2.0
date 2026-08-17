import { useState } from 'react';
import { ArrowUpRight, Lightbulb, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecommendationItem, RecommendationType } from '@campusconnection/shared';
import {
  getRecommendations,
  refreshRecommendations,
  sendRecommendationFeedback,
} from './intelligence.api';
import { requestConnection } from '../social/social.api';
import { joinCommunity, joinProject, joinTeam } from '../collaboration/collaboration.api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  RestrictedState,
  SectionHeading,
  cn,
} from '../../components/ui';
import { apiErrorMessage, isRestrictedApiError, paginatedItems } from '../../lib/api-state';

const types: RecommendationType[] = ['PEOPLE', 'TEAMS', 'PROJECTS', 'COMMUNITIES'];
type Navigation = (target: string) => void;

function targetPath(item: RecommendationItem): string {
  if (item.target.type === 'PERSON') return `/users/${item.target.id}/profile`;
  if (item.target.type === 'TEAM') return `/teams/${item.target.id}`;
  if (item.target.type === 'PROJECT') return `/projects/${item.target.id}`;
  if (item.target.type === 'COMMUNITY') return `/communities/${item.target.id}`;
  return 'search';
}

function targetLabel(item: RecommendationItem): string {
  if (item.target.type === 'PERSON') return 'View profile';
  if (item.target.type === 'TEAM') return 'View team';
  if (item.target.type === 'PROJECT') return 'View project';
  return 'View community';
}

function metadataLabels(item: RecommendationItem): string[] {
  const metadata = item.target.metadata;
  return ['skills', 'interests', 'technologies', 'tags', 'lookingFor']
    .flatMap((key) => {
      const value = metadata[key];
      return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
    })
    .slice(0, 5);
}

function RecommendationCard({
  item,
  onNavigate,
}: {
  item: RecommendationItem;
  onNavigate: Navigation;
}) {
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const feedback = useMutation({
    mutationFn: (kind: 'DISMISS' | 'HELPFUL') =>
      sendRecommendationFeedback(item.targetId, item.type, kind),
    onSuccess: (_value, kind) => {
      setActionMessage(
        kind === 'DISMISS' ? 'Recommendation dismissed.' : 'Thanks for the feedback.',
      );
      void queryClient.invalidateQueries({ queryKey: ['recommendations', item.type] });
    },
  });
  const connect = useMutation({
    mutationFn: () => requestConnection(item.targetId),
    onSuccess: () => setActionMessage('Connection request sent.'),
  });
  const join = useMutation({
    mutationFn: async () => {
      if (item.target.type === 'TEAM') return joinTeam(item.target.id);
      if (item.target.type === 'PROJECT') return joinProject(item.target.id);
      return joinCommunity(item.target.id);
    },
    onSuccess: () => setActionMessage('Your request was sent.'),
  });
  const actionPending = feedback.isPending || connect.isPending || join.isPending;
  const metadata = metadataLabels(item);
  const openTarget = () => onNavigate(targetPath(item));

  return (
    <Card className="theme-intelligence-card flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <button
        type="button"
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 to-cyan/30 text-brand-700"
        aria-label={targetLabel(item)}
        onClick={openTarget}
      >
        {item.target.imageUrl ? (
          <img src={item.target.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Lightbulb className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{item.type.toLowerCase()}</Badge>
          <span className="text-xs text-muted">{Math.round(item.score * 100)}% match</span>
        </div>
        <button type="button" className="mt-1 text-left" onClick={openTarget}>
          <h3 className="font-display text-lg font-bold text-ink hover:text-brand-700">
            {item.target.title}
          </h3>
        </button>
        {item.target.description ? (
          <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted">
            {item.target.description}
          </p>
        ) : null}
        {metadata.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {metadata.map((value) => (
              <Badge key={value}>{value}</Badge>
            ))}
          </div>
        ) : null}
        <ul className="mt-3 grid gap-1.5 text-sm text-slate-600">
          {item.reasons.slice(0, 3).map((reason) => (
            <li key={reason.code} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
              {reason.message}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={openTarget}>
            {targetLabel(item)} <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
          {item.target.type === 'PERSON' ? (
            <Button size="sm" onClick={() => connect.mutate()} disabled={actionPending}>
              Connect
            </Button>
          ) : (
            <Button size="sm" onClick={() => join.mutate()} disabled={actionPending}>
              {item.target.type === 'COMMUNITY' ? 'Join community' : 'Request to join'}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => feedback.mutate('HELPFUL')}
            disabled={actionPending}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Useful
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => feedback.mutate('DISMISS')}
            disabled={actionPending}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Not for me
          </Button>
        </div>
        {actionMessage ? (
          <p className="mt-2 text-xs font-semibold text-brand-700">{actionMessage}</p>
        ) : null}
        {feedback.error || connect.error || join.error ? (
          <p className="mt-2 text-xs font-semibold text-red-700">
            {apiErrorMessage(
              feedback.error ?? connect.error ?? join.error,
              'The action could not be completed.',
            )}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export function IntelligenceHome({ onNavigate }: { onNavigate: Navigation }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<RecommendationType>('PEOPLE');
  const recommendations = useInfiniteQuery({
    queryKey: ['recommendations', type],
    queryFn: ({ pageParam }) => getRecommendations(type, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
  });
  const refresh = useMutation({
    mutationFn: refreshRecommendations,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
  });
  const items = paginatedItems(recommendations.data?.pages);
  const readiness = recommendations.data?.pages[0]?.readiness;
  const openRecommendation = (item: RecommendationItem) => {
    onNavigate(targetPath(item));
  };

  return (
    <section className="space-y-5">
      <SectionHeading
        eyebrow="Intelligence"
        title="Recommended for you"
        description="Explainable suggestions shaped by the interests and activity you choose to share."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw className={cn('h-4 w-4', refresh.isPending && 'animate-spin')} />
            Refresh
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {types.map((item) => (
          <button
            className={cn(
              'rounded-full px-3.5 py-2 text-xs font-bold transition',
              item === type
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'bg-white text-slate-600 ring-1 ring-line hover:bg-brand-50 hover:text-brand-700',
            )}
            type="button"
            key={item}
            onClick={() => setType(item)}
          >
            {item[0] + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {recommendations.isLoading ? (
        <div className="py-8 text-sm text-muted">Finding relevant matches…</div>
      ) : null}
      {isRestrictedApiError(recommendations.error) ? (
        <RestrictedState message="Verify your email before using personalized recommendations." />
      ) : recommendations.error ? (
        <ErrorState
          message={apiErrorMessage(
            recommendations.error,
            'Recommendations are temporarily unavailable.',
          )}
          onRetry={() => void recommendations.refetch()}
        />
      ) : null}
      {refresh.error ? (
        <ErrorState
          message={apiErrorMessage(refresh.error, 'Recommendations could not be refreshed.')}
          onRetry={() => refresh.mutate()}
        />
      ) : null}
      {!recommendations.isLoading &&
      !recommendations.error &&
      !items.length &&
      readiness &&
      !readiness.ready ? (
        <EmptyState
          title="Your recommendations are taking shape"
          description="Add interests, skills, and projects to help CampusConnection find better matches."
          action={
            <Button variant="secondary" onClick={() => onNavigate('profile')}>
              Complete profile
            </Button>
          }
        />
      ) : null}
      {!recommendations.isLoading && !recommendations.error && !items.length && readiness?.ready ? (
        <EmptyState
          title={`No matching ${type.toLowerCase()} yet.`}
          description="We could not find a relevant match in this category yet. Try another category or keep building your campus activity."
        />
      ) : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <RecommendationCard
            key={item.id}
            item={item}
            onNavigate={() => openRecommendation(item)}
          />
        ))}
      </div>
      {recommendations.data?.pages[recommendations.data.pages.length - 1]?.pagination.hasMore ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void recommendations.fetchNextPage()}
          disabled={recommendations.isFetchingNextPage}
        >
          {recommendations.isFetchingNextPage ? 'Loading…' : 'Load more recommendations'}
        </Button>
      ) : null}
    </section>
  );
}
