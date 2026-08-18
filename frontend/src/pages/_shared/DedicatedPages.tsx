import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  Globe2,
  Lightbulb,
  LogOut,
  MessageCircle,
  Rocket,
  Search,
  Users,
} from 'lucide-react';
import { CampusSettingsIcon } from '../../components/icons/CampusIcons';
import type { LucideIcon } from 'lucide-react';
import { CommunicationHome } from '../../features/communication/CommunicationHome';
import { DiscoveryHome } from '../../features/discovery/DiscoveryHome';
import { IntelligenceHome } from '../../features/intelligence/IntelligenceHome';
import { getProjects, getTeams } from '../../features/collaboration/collaboration.api';
import { CompactPageHeader, PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, cn } from '../../components/ui';
import { apiErrorMessage, collectionItems, isRestrictedApiError } from '../../lib/api-state';
import type { useAuthStore } from '../../features/auth/auth.store';

type AppUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;

const destinationCards: Array<[string, string, LucideIcon]> = [
  ['Discover', 'Find the campus context that fits your next step.', Search],
  ['Connect', 'Turn an interesting idea into a conversation.', MessageCircle],
  ['Build', 'Bring the right people into a shared workspace.', Users],
];

function ContextCard({
  icon: Icon,
  label,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
            {label}
          </p>
          <h2 className="type-display mt-1 text-lg font-bold text-ink">{title}</h2>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

function SectionLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-ui inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-brand-600 px-4 text-sm font-bold text-white transition hover:-translate-y-px hover:bg-brand-700"
    >
      {label}
      <ArrowUpRight className="h-4 w-4" />
    </button>
  );
}

export function ExplorePage() {
  return <DiscoveryHome />;
}

export function MessagesPage({ onNavigate }: { onNavigate?: (target: string) => void } = {}) {
  return (
    <div className="page-theme page-theme-messages space-y-7">
      <CommunicationHome
        {...(onNavigate ? { onNavigate } : {})}
        compactHeader={
          <CompactPageHeader
            eyebrow="Messages / Realtime"
            title="Messages that move ideas forward."
            description="Stay close to your campus conversations in real time."
            action={<Badge tone="success">Realtime</Badge>}
          />
        }
      />
    </div>
  );
}

export function ForYouPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <div className="page-theme page-theme-foryou space-y-7">
      <PageHeader
        eyebrow="For you / Intelligence"
        title="A campus shaped around your goals."
        description="Explore explainable suggestions for people, teams, projects, and communities."
        action={<Badge tone="brand">Personalized</Badge>}
      />
      <IntelligenceHome onNavigate={onNavigate} />
    </div>
  );
}

function DirectoryCard({
  title,
  description,
  status,
  metadata,
  icon: Icon,
}: {
  title: string;
  description: string;
  status: string;
  metadata: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="theme-directory-card group p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        <Badge tone={status === 'ACTIVE' || status === 'RECRUITING' ? 'success' : 'neutral'}>
          {status.toLowerCase()}
        </Badge>
      </div>
      <h2 className="type-display mt-5 text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
        <span>{metadata}</span>
        <ArrowUpRight className="h-4 w-4 text-brand-500 transition group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}

function DirectoryState({ query }: { query: ReturnType<typeof useQuery> }) {
  if (query.isLoading) return <p className="py-10 text-sm text-muted">Loading campus directory…</p>;
  if (isRestrictedApiError(query.error)) {
    return <ErrorState message="Verify your email to view this directory." />;
  }
  if (query.error) {
    return (
      <ErrorState
        message={apiErrorMessage(query.error, 'This directory is temporarily unavailable.')}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return null;
}

export function TeamsPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => getTeams() });
  const items = collectionItems(teams.data);
  return (
    <div className="page-theme page-theme-teams space-y-7">
      <PageHeader
        eyebrow="Workspace / Teams"
        title="Find your people and roles."
        description="Browse campus teams that are recruiting, active, and ready to build together."
        action={<SectionLink label="Find teams" onClick={() => onNavigate('search')} />}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [
            'Open teams',
            teams.isLoading
              ? '—'
              : String(items.filter((item) => item.status === 'RECRUITING').length),
            'Recruiting now',
          ],
          [
            'Active teams',
            teams.isLoading ? '—' : String(items.filter((item) => item.status === 'ACTIVE').length),
            'Building together',
          ],
          ['Your next role', '1', 'Start with a conversation'],
        ].map(([label, value, detail]) => (
          <Card key={label} className="p-5">
            <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
              {label}
            </p>
            <p className="type-display mt-2 text-3xl font-bold text-ink">{value}</p>
            <p className="mt-1 text-sm text-muted">{detail}</p>
          </Card>
        ))}
      </div>
      <DirectoryState query={teams} />
      {!teams.isLoading && !teams.error && !items.length ? (
        <EmptyState
          title="No public teams yet"
          description="Create or join a team from the workspace when you are ready to build."
          action={<SectionLink label="Open workspace" onClick={() => onNavigate('communities')} />}
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <DirectoryCard
            key={item.id}
            title={item.name}
            description={item.description}
            status={item.status}
            metadata={`${item.visibility.toLowerCase()} · max ${item.maxMembers ?? 'open'} members`}
            icon={Users}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectsPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  const projects = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });
  const items = collectionItems(projects.data);
  return (
    <div className="page-theme page-theme-projects space-y-7">
      <PageHeader
        eyebrow="Workspace / Projects"
        title="Make progress visible."
        description="Explore campus projects, the technologies behind them, and the teams turning ideas into delivery."
        action={
          <SectionLink label="Open project workspace" onClick={() => onNavigate('communities')} />
        }
      />
      <Card className="overflow-hidden bg-brand-700 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <Badge tone="warning">Project studio</Badge>
            <h2 className="type-display mt-4 text-2xl font-bold sm:text-3xl">
              Ideas become stronger in public.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              Follow the work, find a role, and bring your own project into the campus ecosystem.
            </p>
          </div>
          <Rocket className="h-14 w-14 text-yellow" />
        </div>
      </Card>
      <DirectoryState query={projects} />
      {!projects.isLoading && !projects.error && !items.length ? (
        <EmptyState
          title="No public projects yet"
          description="Create a project from the workspace to give an idea a place to grow."
          action={
            <SectionLink label="Create a project" onClick={() => onNavigate('communities')} />
          }
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <DirectoryCard
            key={item.id}
            title={item.name}
            description={item.description}
            status={item.status}
            metadata={item.technologies.length ? item.technologies.join(' · ') : 'Campus project'}
            icon={FolderKanban}
          />
        ))}
      </div>
    </div>
  );
}

function ComingSoonPage({
  eyebrow,
  title,
  description,
  icon: Icon,
  onNavigate,
  primaryAction,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onNavigate: (id: string) => void;
  primaryAction: string;
  secondaryLabel: string;
}) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Popular', 'New'];
  return (
    <div
      className={cn(
        'page-theme space-y-7',
        eyebrow.includes('Events') && 'page-theme-events',
        eyebrow.includes('Resources') && 'page-theme-resources',
      )}
    >
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={<Badge tone="warning">Coming into focus</Badge>}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                'rounded-full px-3.5 py-2 text-xs font-bold transition',
                filter === item
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-muted ring-1 ring-line hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="type-meta text-xs text-muted">{filter} view</span>
      </div>
      <Card className="relative overflow-hidden bg-white p-7 sm:p-10">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-yellow-light blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex rounded-2xl bg-brand-50 p-3 text-brand-600">
            <Icon className="h-7 w-7" />
          </span>
          <h2 className="type-display mt-6 text-2xl font-bold text-ink">
            A dedicated space for what is next.
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            This destination is ready for its domain content. The page structure, navigation,
            filters, and responsive composition are in place without inventing data or changing
            backend contracts.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <SectionLink label={primaryAction} onClick={() => onNavigate('search')} />
            <Button variant="secondary" onClick={() => onNavigate('communities')}>
              {secondaryLabel}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {destinationCards.map(([label, copy, Icon]) => (
          <ContextCard
            key={String(label)}
            icon={Icon}
            label={String(label)}
            title={String(label)}
            description={String(copy)}
          />
        ))}
      </div>
    </div>
  );
}

export function EventsPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <ComingSoonPage
      eyebrow="Workspace / Events"
      title="Make time for campus life."
      description="A focused home for events, meetups, talks, and moments worth showing up for."
      icon={CalendarDays}
      onNavigate={onNavigate}
      primaryAction="Explore campus"
      secondaryLabel="Build with a team"
    />
  );
}

export function HackathonsPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <ComingSoonPage
      eyebrow="Opportunities / Hackathons"
      title="Build. Compete. Win."
      description="Find high-energy challenges, meet ambitious builders, and make your next weekend count."
      icon={Rocket}
      onNavigate={onNavigate}
      primaryAction="Find collaborators"
      secondaryLabel="Open workspace"
    />
  );
}

export function ResourcesPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <ComingSoonPage
      eyebrow="Learn / Resources"
      title="Learn, explore, build."
      description="A curated knowledge space for the guides, references, and practical ideas that help campus work move further."
      icon={Lightbulb}
      onNavigate={onNavigate}
      primaryAction="Explore people and ideas"
      secondaryLabel="Find a project"
    />
  );
}

export function ProfilePage({ user }: { user: AppUser }) {
  return (
    <div className="space-y-7">
      <Card className="overflow-hidden">
        <div className="relative h-32 bg-brand-100">
          <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_70%_35%,rgba(254,178,26,.9),transparent_18%),linear-gradient(120deg,transparent_10%,rgba(19,70,134,.12))]" />
        </div>
        <div className="px-5 pb-7 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={user.displayName} src={user.avatarUrl} size="xl" />
              <div className="pb-1">
                <h2 className="type-display text-xl font-bold text-ink">{user.displayName}</h2>
                <p className="text-sm text-muted">@{user.username}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm">
              <CampusSettingsIcon className="h-4 w-4" />
              Edit profile
            </Button>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              ['Campus', user.college ?? 'Add your college'],
              ['Focus', user.course ?? 'Add your course'],
              [
                'Interests',
                user.interests?.length ? user.interests.join(', ') : 'Add your interests',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  {label}
                </p>
                <p className="mt-1 font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
          {user.bio ? (
            <p className="mt-6 max-w-2xl text-sm leading-7 text-muted">{user.bio}</p>
          ) : null}
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <ContextCard
          icon={Users}
          label="Identity"
          title="Be discoverable"
          description="A clear profile gives conversations a meaningful starting point."
        />
        <ContextCard
          icon={FolderKanban}
          label="Work"
          title="Show your work"
          description="Projects and teams help your campus identity become tangible."
        />
        <ContextCard
          icon={Globe2}
          label="Campus"
          title="Stay connected"
          description="Follow the spaces and people that align with your direction."
        />
      </div>
    </div>
  );
}

export function SettingsPage({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Settings / Account"
        title="Make CampusConnection yours."
        description="Manage your session and keep your account configuration clear."
        action={<Badge tone="brand">Account settings</Badge>}
      />
      <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <Card className="p-3">
          <p className="type-ui px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
            Account
          </p>
          {['Profile', 'Account', 'Privacy', 'Notifications', 'Appearance', 'Security'].map(
            (item, index) => (
              <button
                key={item}
                type="button"
                className={cn(
                  'type-ui flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-sm font-semibold',
                  index === 0
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-muted hover:bg-slate-50 hover:text-ink',
                )}
              >
                {item}
              </button>
            ),
          )}
        </Card>
        <Card className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="type-display text-xl font-bold text-ink">Session security</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                Your account is secured by email verification and CampusConnection sessions.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <p className="mt-3 text-sm font-bold text-ink">Email verified</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                Your account is activated after secure SMTP email verification.
              </p>
            </div>
            <div className="rounded-xl bg-brand-50 p-4">
              <Globe2 className="h-5 w-5 text-brand-600" />
              <p className="mt-3 text-sm font-bold text-ink">Session protected</p>
              <p className="mt-1 text-xs leading-6 text-muted">
                Refresh tokens remain stored in a secure HttpOnly cookie.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
