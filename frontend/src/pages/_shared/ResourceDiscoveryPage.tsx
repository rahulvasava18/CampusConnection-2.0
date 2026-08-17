import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, FolderKanban, Search, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { apiErrorMessage, isRestrictedApiError } from '../../lib/api-state';

export type ResourceDiscoveryItem = {
  id: string;
  name: string;
  description: string;
  status: string;
  metadata: string;
  ownerId?: string;
};

type ResourceDiscoveryPageProps = {
  resourceLabel: string;
  resourcePlural: string;
  searchPlaceholder: string;
  heading: string;
  filters: string[];
  items: ResourceDiscoveryItem[];
  myItems: ResourceDiscoveryItem[];
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
  onNavigate: (target: string) => void;
  icon: LucideIcon;
  createTitle: string;
  createLabel: string;
  createDescription: string;
  activityTitle: string;
  activityDescription: string;
  createTarget?: string;
};

function ResourceCard({ item, icon: Icon }: { item: ResourceDiscoveryItem; icon: LucideIcon }) {
  const active = item.status === 'ACTIVE' || item.status === 'RECRUITING';
  return (
    <Card className="group p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <Badge tone={active ? 'success' : 'neutral'}>{item.status.toLowerCase()}</Badge>
      </div>
      <h3 className="type-display mt-5 text-lg font-bold text-ink">{item.name}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{item.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>{item.metadata}</span>
        <ArrowUpRight className="h-4 w-4 text-brand-500 transition group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}

function CreateResourceCard({
  title,
  label,
  description,
  onCreate,
}: {
  title: string;
  label: string;
  description: string;
  onCreate?: () => void;
}) {
  return (
    <Card className="bg-gradient-to-br from-brand-50 to-cyan/10 p-5">
      <Sparkles className="h-5 w-5 text-brand-600" aria-hidden="true" />
      <h2 className="type-display mt-4 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <Button
        className="mt-4 w-full"
        variant="secondary"
        onClick={onCreate}
        disabled={!onCreate}
        title={!onCreate ? 'Creation is not available yet.' : undefined}
      >
        Create {label}
      </Button>
    </Card>
  );
}

function MyResourceCard({
  resourcePlural,
  items,
  emptyDescription,
}: {
  resourcePlural: string;
  items: ResourceDiscoveryItem[];
  emptyDescription: string;
}) {
  return (
    <Card className="p-5">
      <h2 className="type-display text-lg font-bold text-ink">My {resourcePlural}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">{emptyDescription}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-ink hover:bg-brand-50"
            >
              {item.name}
              <span className="mt-1 block text-xs font-normal text-muted">{item.metadata}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ResourceDiscoveryPage({
  resourceLabel,
  resourcePlural,
  searchPlaceholder,
  heading,
  filters,
  items,
  myItems,
  isLoading,
  error,
  onRetry,
  onNavigate,
  icon: Icon,
  createTitle,
  createLabel,
  createDescription,
  activityTitle,
  activityDescription,
  createTarget,
}: ResourceDiscoveryPageProps) {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(filters[0] ?? 'All');
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch);
      const matchesFilter = activeFilter === 'All' || item.status === activeFilter.toUpperCase();
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, items, search]);
  const create = createTarget ? () => onNavigate(createTarget) : undefined;

  return (
    <div className="space-y-7">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <Card className="p-3">
            <label className="flex items-center gap-3 px-2">
              <Search className="h-5 w-5 text-brand-500" aria-hidden="true" />
              <span className="sr-only">{searchPlaceholder}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="min-h-11 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
              />
            </label>
          </Card>
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label={`${resourceLabel} filters`}>
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition ${activeFilter === filter ? 'bg-brand-600 text-white' : 'bg-white text-muted ring-1 ring-line hover:text-brand-700'}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="type-display text-xl font-bold text-ink">{heading}</h1>
            <span className="text-xs font-semibold text-muted">{visibleItems.length} shown</span>
          </div>
          {isLoading ? <LoadingState label={`Finding ${resourcePlural.toLowerCase()}`} /> : null}
          {isRestrictedApiError(error) ? (
            <ErrorState message={`Verify your email to view ${resourcePlural.toLowerCase()}.`} />
          ) : error ? (
            <ErrorState
              message={apiErrorMessage(error, `${resourcePlural} could not be loaded.`)}
              {...(onRetry ? { onRetry } : {})}
            />
          ) : null}
          {!isLoading && !error && visibleItems.length === 0 ? (
            <EmptyState
              title={`No ${resourcePlural.toLowerCase()} found`}
              description={`Try another search or create the first ${resourceLabel.toLowerCase()}.`}
              action={
                create ? (
                  <Button onClick={create}>Create {resourceLabel.toLowerCase()}</Button>
                ) : undefined
              }
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {visibleItems.map((item) => (
              <ResourceCard key={item.id} item={item} icon={Icon} />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 pt-3">
            <h2 className="type-display text-xl font-bold text-ink">{activityTitle}</h2>
            <span className="text-xs font-semibold text-muted">Campus activity</span>
          </div>
          <EmptyState
            title={`No ${activityTitle.toLowerCase()} yet`}
            description={activityDescription}
          />
        </div>
        <aside className="space-y-5">
          <CreateResourceCard
            title={createTitle}
            label={createLabel}
            description={createDescription}
            {...(create ? { onCreate: create } : {})}
          />
          <MyResourceCard
            resourcePlural={resourcePlural}
            items={myItems}
            emptyDescription={`Join or create a ${resourceLabel.toLowerCase()} and it will appear here.`}
          />
        </aside>
      </div>
    </div>
  );
}

export const resourceIcons = {
  team: Users,
  project: FolderKanban,
  event: CalendarDays,
} as const;
