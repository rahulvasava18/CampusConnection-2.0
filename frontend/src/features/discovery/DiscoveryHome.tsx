import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Search as SearchIcon, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { SearchEntityType, SearchResult } from '@campusconnection/shared';
import { autocomplete, search } from './discovery.api';
import { Badge, Button, Card, EmptyState, ErrorState, cn } from '../../components/ui';
import { useAppStore } from '../../store/app-store';
import { DefaultDiscoveryGrid } from './DefaultDiscoveryGrid';
import { CompactPageTop } from '../../components/PageHeader';

const tabs: Array<{ value?: SearchEntityType; label: string }> = [
  { label: 'All' },
  { value: 'people', label: 'People' },
  { value: 'communities', label: 'Communities' },
  { value: 'teams', label: 'Teams' },
  { value: 'projects', label: 'Projects' },
];

export function DiscoveryHome({
  onNavigate,
  compactHeader,
}: {
  onNavigate?: (target: string) => void;
  compactHeader?: ReactNode;
}) {
  const sharedQuery = useAppStore((state) => state.discoveryQuery);
  const setSharedQuery = useAppStore((state) => state.setDiscoveryQuery);
  const [query, setQuery] = useState(sharedQuery);
  const [type, setType] = useState<SearchEntityType>();
  const [cursor, setCursor] = useState<string>();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const resultsQuery = useQuery({
    queryKey: ['discovery-search', query, type, cursor],
    queryFn: () => search(query.trim(), type, cursor),
    enabled: query.trim().length >= 2,
  });
  const suggestions = useQuery({
    queryKey: ['discovery-autocomplete', suggestionQuery],
    queryFn: () => autocomplete(suggestionQuery),
    enabled: suggestionQuery.length >= 1,
  });

  useEffect(() => {
    if (sharedQuery !== query) setQuery(sharedQuery);
  }, [query, sharedQuery]);
  useEffect(() => {
    setCursor(undefined);
    setResults([]);
  }, [query, type]);
  useEffect(() => {
    if (!resultsQuery.data || resultsQuery.isFetching) return;
    setResults((current) =>
      cursor ? [...current, ...resultsQuery.data.data] : resultsQuery.data.data,
    );
  }, [resultsQuery.data, resultsQuery.isFetching, cursor]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSuggestionQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const clearSearch = () => {
    setQuery('');
    setSharedQuery('');
    setSuggestionQuery('');
    setCursor(undefined);
    setResults([]);
  };
  const updateQuery = (value: string) => {
    setQuery(value);
    setSharedQuery(value);
  };

  const searchPanel = (
      <Card className="rounded-[20px] border-slate-200 p-6 shadow-[0_8px_22px_rgba(15,23,42,.06)] sm:p-7">
        <div className="relative">
          <SearchIcon className="absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2 text-brand-500" />
          <input
            aria-label="Search campus"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search React teams, communities, people…"
            className="w-full rounded-[15px] border border-slate-200 bg-slate-50 py-4 pl-14 pr-12 text-lg text-ink outline-none transition placeholder:text-slate-500 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {suggestions.data?.length && query.length < 2 ? (
            <div className="mt-3 grid gap-1">
              {suggestions.data.map((item) => (
                <button
                  type="button"
                  key={`${item.type}-${item.id}`}
                  onClick={() => updateQuery(item.title)}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                >
                  <span>{item.title}</span>
                  <span className="text-xs text-slate-400">{item.type}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {tabs.map((tab) => (
            <button
              type="button"
              className={cn(
                'rounded-full px-4 py-2.5 text-sm font-bold transition',
                type === tab.value
                  ? 'bg-brand-700 text-white shadow-[0_5px_12px_rgba(13,49,95,.2)]'
                  : 'bg-slate-100 text-brand-800 hover:bg-brand-50 hover:text-brand-700',
              )}
              key={tab.label}
              onClick={() => setType(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>
  );

  return (
    <section className="page-theme page-theme-search mx-auto w-full max-w-6xl space-y-5">
      {compactHeader ? (
        <CompactPageTop control={searchPanel} header={compactHeader} />
      ) : (
        searchPanel
      )}
      {resultsQuery.isLoading ? <div className="py-8 text-sm text-muted">Searching…</div> : null}
      {!query.trim() && !type && onNavigate && !resultsQuery.isFetching && !resultsQuery.error ? (
        <DefaultDiscoveryGrid onNavigate={onNavigate} />
      ) : null}
      {resultsQuery.isError ? (
        <ErrorState
          message="Search is temporarily unavailable."
          onRetry={() => void resultsQuery.refetch()}
        />
      ) : null}
      {!resultsQuery.isLoading &&
      query.trim().length >= 2 &&
      !results.length &&
      !resultsQuery.isError ? (
        <EmptyState
          title="No visible results yet"
          description="Try another search term or explore a different category."
        />
      ) : null}
      <div className="grid gap-3">
        {results.map((item) => (
          <SearchResultCard
            key={`${item.type}-${item.id}`}
            item={item}
            onOpen={
              onNavigate
                ? () =>
                    onNavigate(
                      item.type === 'person'
                        ? `/users/${item.id}/profile`
                        : item.type === 'team'
                          ? `/teams/${item.id}`
                          : item.type === 'project'
                            ? `/projects/${item.id}`
                            : `/communities/${item.id}`,
                    )
                : undefined
            }
          />
        ))}
      </div>
      {resultsQuery.data?.pagination.hasMore ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={resultsQuery.isFetching}
          onClick={() => setCursor(resultsQuery.data?.pagination.nextCursor ?? undefined)}
        >
          {resultsQuery.isFetching ? 'Loading…' : 'Load more results'}
        </Button>
      ) : null}
    </section>
  );
}

function SearchResultCard({
  item,
  onOpen,
}: {
  item: SearchResult;
  onOpen?: (() => void) | undefined;
}) {
  const metadata =
    typeof item.metadata.college === 'string'
      ? item.metadata.college
      : typeof item.metadata.category === 'string'
        ? item.metadata.category
        : '';
  return (
    <Card className="group flex gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-sm font-bold text-brand-700">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          item.title.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{item.type}</Badge>
          {metadata ? <span className="text-xs text-muted">{metadata}</span> : null}
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 text-left font-display font-bold text-ink hover:text-brand-700"
          >
            {item.title}
          </button>
        ) : (
          <h3 className="mt-1 font-display font-bold text-ink">{item.title}</h3>
        )}
        {item.snippet ? <p className="mt-1 text-sm leading-6 text-muted">{item.snippet}</p> : null}
      </div>
      {onOpen ? (
        <button type="button" aria-label={`Open ${item.title}`} onClick={onOpen}>
          <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand-700" />
        </button>
      ) : (
        <ArrowUpRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-brand-700" />
      )}
    </Card>
  );
}
