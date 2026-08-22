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
    <Card className="theme-community-card group flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_10px_26px_rgba(15,23,42,.08)] sm:p-6">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Network className="h-6 w-6" aria-hidden="true" />
          </span>
          <Badge tone={joined ? 'success' : pending ? 'brand' : 'neutral'}>
            {joined ? 'Joined' : pending ? 'Request pending' : community.privacy}
          </Badge>
        </div>
        <h3 className="type-display mt-4 text-xl font-bold text-ink group-hover:text-brand-700">
          {community.name}
        </h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
          {community.category}
        </p>
        <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-6 text-muted">{community.description}</p>
      </button>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm font-semibold text-muted">
          {community.memberCount ?? 0} members
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          {joined && onLeave ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onLeave}
              className="min-h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
            >
              Leave
            </Button>
          ) : null}
          {!joined && !pending && onJoin ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onJoin} className="min-h-10 rounded-xl px-4">
              {busy ? 'Updating...' : community.privacy === 'PRIVATE' ? 'Request to join' : 'Join'}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Open ${community.name}`}
            onClick={onOpen}
            className="min-h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700"
          >
            More info
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
