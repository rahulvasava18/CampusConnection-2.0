import type { CSSProperties } from 'react';
import {
  BarChart3,
  CalendarDays,
  Check,
  Code2,
  FolderKanban,
  Megaphone,
  MessageCircle,
  Network,
  Puzzle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button, Card, cn } from './ui';

type WorkspaceKind = 'communities' | 'clubs' | 'teams' | 'projects' | 'events';

const workspaceContent: Record<
  WorkspaceKind,
  {
    eyebrow: string;
    title: string;
    description: string;
    actionLabel: string;
    accent: string;
  }
> = {
  communities: {
    eyebrow: 'Workspace / Communities',
    title: 'Find your people.',
    description: 'Discover communities built around interests, questions, and shared goals.',
    actionLabel: 'Explore Communities',
    accent: '#16803d',
  },
  clubs: {
    eyebrow: 'Workspace / Clubs',
    title: 'Build something official.',
    description: 'Create your club, bring students together, and get verified by admins.',
    actionLabel: 'Create a Club',
    accent: '#16803d',
  },
  teams: {
    eyebrow: 'Workspace / Teams',
    title: 'Team up and build.',
    description: 'Create teams for hackathons, projects, assignments, and more.',
    actionLabel: 'Create a Team',
    accent: '#2563c7',
  },
  projects: {
    eyebrow: 'Workspace / Projects',
    title: 'Showcase your work.',
    description: 'Share your projects, get feedback, and inspire others.',
    actionLabel: 'Add Project',
    accent: '#5b2bbf',
  },
  events: {
    eyebrow: 'Workspace / Events',
    title: 'Make time for campus life.',
    description: 'Discover and create events that bring campus together.',
    actionLabel: 'Explore Events',
    accent: '#e45716',
  },
};

function Illustration({ kind }: { kind: WorkspaceKind }) {
  const accent = 'text-[var(--workspace-accent)]';
  const softSurface = 'bg-[color:var(--workspace-accent)/.12]';
  const iconClass = 'h-5 w-5';

  if (kind === 'communities') {
    return (
      <div className="relative h-28 w-full max-w-[15rem]" aria-hidden="true">
        <div className={cn('absolute left-1/2 top-5 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-[1.35rem] border border-current/20', softSurface, accent)}>
          <Network className="h-9 w-9" />
        </div>
        <div className={cn('absolute left-2 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <Users className={iconClass} />
        </div>
        <div className={cn('absolute right-2 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <MessageCircle className={iconClass} />
        </div>
        <div className={cn('absolute left-1/2 bottom-0 h-px w-48 -translate-x-1/2 bg-current/25', accent)} />
      </div>
    );
  }

  if (kind === 'clubs') {
    return (
      <div className="relative h-28 w-full max-w-[15rem]" aria-hidden="true">
        <div className={cn('absolute left-1/2 top-4 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-[1.35rem] border border-current/20', softSurface, accent)}>
          <ShieldCheck className="h-9 w-9" />
        </div>
        <div className={cn('absolute left-4 top-14 flex h-11 w-11 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <Users className={iconClass} />
        </div>
        <div className={cn('absolute right-4 top-14 flex h-11 w-11 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <CalendarDays className={iconClass} />
        </div>
        <div className={cn('absolute left-1/2 bottom-0 h-px w-48 -translate-x-1/2 bg-current/25', accent)} />
      </div>
    );
  }

  if (kind === 'teams') {
    return (
      <div className="relative h-28 w-full max-w-[15rem]" aria-hidden="true">
        <div className={cn('absolute left-1/2 top-4 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-[1.35rem] border border-current/20', softSurface, accent)}>
          <Puzzle className="h-9 w-9" />
        </div>
        <div className={cn('absolute left-4 top-14 flex h-11 w-11 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <Users className={iconClass} />
        </div>
        <div className={cn('absolute right-4 top-14 flex h-11 w-11 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <Check className={iconClass} />
        </div>
        <div className={cn('absolute left-1/2 bottom-0 h-px w-48 -translate-x-1/2 bg-current/25', accent)} />
      </div>
    );
  }

  if (kind === 'projects') {
    return (
      <div className="relative h-28 w-full max-w-[15rem]" aria-hidden="true">
        <div className={cn('absolute left-1/2 top-3 flex h-20 w-32 -translate-x-1/2 items-center justify-center rounded-2xl border border-current/25', softSurface, accent)}>
          <div className="grid grid-cols-2 gap-2">
            <Code2 className={iconClass} />
            <BarChart3 className={iconClass} />
            <span className="h-1.5 w-8 rounded-full bg-current/35" />
            <FolderKanban className={iconClass} />
          </div>
        </div>
        <div className={cn('absolute left-3 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <Sparkles className={iconClass} />
        </div>
        <div className={cn('absolute right-3 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
          <FolderKanban className={iconClass} />
        </div>
        <div className={cn('absolute left-1/2 bottom-0 h-px w-48 -translate-x-1/2 bg-current/25', accent)} />
      </div>
    );
  }

  return (
    <div className="relative h-28 w-full max-w-[15rem]" aria-hidden="true">
      <div className={cn('absolute left-1/2 top-3 flex h-20 w-32 -translate-x-1/2 items-center justify-center rounded-2xl border border-current/25', softSurface, accent)}>
        <CalendarDays className="h-12 w-12" />
      </div>
      <div className={cn('absolute left-3 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
        <Megaphone className={iconClass} />
      </div>
      <div className={cn('absolute right-3 top-12 flex h-10 w-10 items-center justify-center rounded-full border border-current/20', softSurface, accent)}>
        <Sparkles className={iconClass} />
      </div>
      <div className={cn('absolute left-1/2 bottom-0 h-px w-48 -translate-x-1/2 bg-current/25', accent)} />
    </div>
  );
}

export function WorkspaceCreateCard({
  kind,
  onAction,
}: {
  kind: WorkspaceKind;
  onAction: () => void;
}) {
  const content = workspaceContent[kind];
  const cardStyle = { '--workspace-accent': content.accent } as CSSProperties;

  return (
    <Card
      className="group flex h-full min-h-[17rem] flex-col overflow-hidden border-brand-200 p-5 shadow-[0_14px_30px_rgba(15,23,42,.07)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,.12)] sm:p-6"
      data-workspace-kind={kind}
      style={cardStyle}
    >
      <p className="type-ui text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--workspace-accent)]">
        {content.eyebrow}
      </p>
      <h1 className="type-display mt-2 text-2xl font-bold tracking-tight text-ink">
        {content.title}
      </h1>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">{content.description}</p>
      <div className="flex min-h-28 flex-1 items-center justify-center py-2 transition duration-200 group-hover:scale-[1.02]">
        <Illustration kind={kind} />
      </div>
      <Button
        type="button"
        className="w-full !bg-[var(--workspace-accent)] !text-white shadow-[0_8px_18px_rgba(15,23,42,.14)] hover:brightness-110"
        onClick={onAction}
      >
        {kind === 'communities' ? <Search className="h-5 w-5" /> : null}
        {kind === 'clubs' || kind === 'teams' ? <Users className="h-5 w-5" /> : null}
        {kind === 'projects' ? <FolderKanban className="h-5 w-5" /> : null}
        {kind === 'events' ? <CalendarDays className="h-5 w-5" /> : null}
        {content.actionLabel}
      </Button>
    </Card>
  );
}
