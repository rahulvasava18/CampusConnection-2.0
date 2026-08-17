import { ArrowUpRight, Network } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import type { CommunityView } from '../../../features/community/community.types';

export function CommunityCard({
  community,
  onOpen,
  onJoin,
  onLeave,
  busy = false,
}: {
  community: CommunityView;
  onOpen: () => void;
  onJoin?: () => void;
  onLeave?: () => void;
  busy?: boolean;
}) {
  const joined = community.isMember === true;
  const pending = community.membershipStatus === 'PENDING';
  return (
    <Card className="theme-community-card group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,.08)]">
      <button type="button" className="text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Network className="h-5 w-5" />
          </span>
          <Badge tone={joined ? 'success' : pending ? 'brand' : 'neutral'}>
            {joined ? 'Joined' : pending ? 'Request pending' : community.privacy}
          </Badge>
        </div>
        <h3 className="type-display mt-5 text-lg font-bold text-ink group-hover:text-brand-700">
          {community.name}
        </h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
          {community.category}
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{community.description}</p>
      </button>
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-xs font-semibold text-muted">
          {community.memberCount ?? 0} members
        </span>
        <div className="flex gap-2">
          {joined && onLeave ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onLeave}
              className="border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
            >
              Leave
            </Button>
          ) : null}
          {!joined && !pending && onJoin ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onJoin}>
              {busy ? 'Joining...' : 'Join'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Open ${community.name}`}
            onClick={onOpen}
            className="border border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700"
          >
            {' '}
            Enter
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
