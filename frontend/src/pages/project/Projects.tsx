import { ChevronRight, Search, FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectView } from '@campusconnection/shared';
import { getProjectActivity, getProjects, joinProject } from '../../features/collaboration/collaboration.api';
import { collectionItems, apiErrorMessage, isRestrictedApiError } from '../../lib/api-state';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { CompactPageHeader, CompactPageTop } from '../../components/PageHeader';

function ProjectCard({
  project,
  onOpen,
  onJoin,
  joinPending,
}: {
  project: ProjectView;
  onOpen: () => void;
  onJoin: () => void;
  joinPending: boolean;
}) {
  const progress = project.progressPercent ?? 0;
  return (
    <Card
      className="theme-project-card group flex h-full cursor-pointer flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-6"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <FolderKanban className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex gap-2">
          <Badge tone={project.status === 'COMPLETED' ? 'success' : 'brand'}>
            {project.status}
          </Badge>
          <Badge tone="neutral">{project.visibility}</Badge>
        </div>
      </div>
      <h2 className="type-display mt-4 text-xl font-bold text-ink">{project.name}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">
        {project.objective ?? project.description}
      </p>
      <div className="mt-5">
        <div className="flex justify-between text-xs font-semibold text-muted">
          <span>{progress}% complete</span>
          <span>{project.memberCount ?? 0} collaborators</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {project.tags?.slice(0, 4).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        {project.category ? <Badge tone="neutral">{project.category}</Badge> : null}
      </div>
      <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-line pt-4" onClick={(event) => event.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={onOpen} className="min-h-10 rounded-xl px-4">
          {project.isMember ? 'Enter project' : 'More info'}
        </Button>
        {!project.isMember && project.membershipStatus === 'PENDING' ? (
          <Button size="sm" variant="ghost" disabled className="min-h-10 rounded-xl px-4">
            Requested
          </Button>
        ) : !project.isMember && project.visibility !== 'PRIVATE' ? (
          <Button size="sm" onClick={onJoin} disabled={joinPending} className="min-h-10 rounded-xl px-4">
            {joinPending ? 'Requesting…' : 'Request to join'}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function Projects({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const projects = useQuery({
    queryKey: ['projects', { search, status, category, tags }],
    queryFn: () => getProjects({ search, status, category, tags }),
  });
  const items = collectionItems(projects.data);
  const activityQueries = useQueries({
    queries: items.map((project) => ({
      queryKey: ['project-activity', project.id],
      queryFn: () => getProjectActivity(project.id),
      enabled: Boolean(project.isMember),
    })),
  });
  const activity = activityQueries.flatMap((query) => query.data?.data ?? []).slice(0, 8);
  const userProjects = items.filter(
    (project) => project.isMember || project.membershipRole === 'OWNER',
  );
  const join = useMutation({
    mutationFn: (projectId: string) => joinProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  return (
    <div className="page-theme page-theme-projects space-y-6">
      <CompactPageTop
        control={
          <Card className="min-h-[17rem] space-y-4 p-4 sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border border-line bg-slate-50 px-4 py-3">
          <Search className="h-5 w-5 text-brand-500" />
          <span className="sr-only">Search projects</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {['All', 'Planning', 'Active', 'Completed'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`rounded-full px-4 py-2 text-xs font-bold ${status === item ? 'bg-brand-600 text-white' : 'bg-white text-muted ring-1 ring-line'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            aria-label="Project category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Filter by category"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none"
          />
          <input
            aria-label="Project tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Filter by tags"
            className="rounded-xl border border-line px-3 py-2.5 text-sm outline-none"
          />
        </div>
          </Card>
        }
        header={
          <CompactPageHeader
            eyebrow="Workspace / Projects"
            title="Make progress visible."
            description="Explore what campus builders are developing, researching, and completing."
            action={<Button onClick={() => onNavigate('/projects/create')}>Create project</Button>}
          />
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="type-display text-xl font-bold text-ink">Discover projects</h1>
            <span className="text-xs font-semibold text-muted">{items.length} shown</span>
          </div>
          {projects.isLoading ? <LoadingState label="Finding projects" /> : null}
          {isRestrictedApiError(projects.error) ? (
            <ErrorState message="Verify your email to discover projects." />
          ) : projects.error ? (
            <ErrorState
              message={apiErrorMessage(projects.error, 'Projects could not be loaded.')}
              onRetry={() => void projects.refetch()}
            />
          ) : null}
          {!projects.isLoading && !projects.error && !items.length ? (
            <EmptyState
              title="No projects found"
              description="Try another search or create the first project."
              action={
                <Button onClick={() => onNavigate('/projects/create')}>Create project</Button>
              }
            />
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onNavigate(`/projects/${project.id}`)}
                onJoin={() => join.mutate(project.id)}
                joinPending={join.isPending && join.variables === project.id}
              />
            ))}
          </div>
        </div>
        <aside className="space-y-5">
          <Card className="p-5">
            <h2 className="type-display text-lg font-bold text-ink">My Projects</h2>
            {userProjects.length ? (
              <div className="mt-4 space-y-2">
                {userProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onNavigate(`/projects/${project.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-slate-50 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <FolderKanban className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{project.name}</span>
                      <span className="mt-1 block text-xs text-muted">
                        {project.progressPercent ?? 0}% complete
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                No projects yet. Join or create your first project.
              </p>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="type-display text-lg font-bold text-ink">Recent project activity</h2>
              <Badge tone="neutral">Live</Badge>
            </div>
            {activity.length ? (
              <div className="mt-4 divide-y divide-line">
                {activity.map((entry) => (
                  <p key={entry.id} className="py-3 text-sm leading-6 text-muted first:pt-0 last:pb-0">
                    {entry.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                Activity will appear as project work progresses.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
