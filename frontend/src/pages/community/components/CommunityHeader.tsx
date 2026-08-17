import { ArrowLeft, LogOut, MessageCircle, Network } from 'lucide-react';
import { Badge, Button, Card } from '../../../components/ui';
import type { CommunityView } from '../../../features/community/community.types';

export function CommunityHeader({
  community,
  onBack,
  onJoin,
  onLeave,
  onCreateDiscussion,
  onManage,
  onInvite,
  busy = false,
}: {
  community: CommunityView;
  onBack: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onCreateDiscussion: () => void;
  onManage?: (() => void) | undefined;
  onInvite?: (() => void) | undefined;
  busy?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-brand-800 px-5 py-7 text-white sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Communities
        </button>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{community.category}</Badge>
              <Badge tone="neutral">{community.privacy}</Badge>
            </div>
            <h1 className="type-display mt-3 text-3xl font-bold">{community.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">
              {community.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {community.membershipStatus === 'PENDING' ? (
              <Button size="sm" variant="secondary" disabled>
                Request pending
              </Button>
            ) : community.isMember ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onLeave}>
                <LogOut className="h-4 w-4" /> Leave
              </Button>
            ) : (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onJoin}>
                {busy ? 'Joining...' : 'Join community'}
              </Button>
            )}
            {community.isMember ? (
              <Button size="sm" onClick={onCreateDiscussion}>
                <MessageCircle className="h-4 w-4" /> Create post
              </Button>
            ) : null}
            {onInvite &&
            community.isMember &&
            ['OWNER', 'ADMIN'].includes(community.membershipRole ?? '') ? (
              <Button size="sm" variant="secondary" onClick={onInvite}>
                Invite
              </Button>
            ) : null}
            {onManage &&
            community.isMember &&
            ['OWNER', 'ADMIN', 'MODERATOR'].includes(community.membershipRole ?? '') ? (
              <Button size="sm" variant="secondary" onClick={onManage}>
                Manage
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 px-5 py-4 text-xs font-semibold text-muted sm:px-8">
        <span className="inline-flex items-center gap-2">
          <Network className="h-4 w-4 text-brand-600" /> {community.memberCount ?? 0} members
        </span>
        <span>Created by {community.ownerId === 'self' ? 'you' : 'a CampusConnection member'}</span>
      </div>
    </Card>
  );
}
