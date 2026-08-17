import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { Badge, Card } from '../../../components/ui';
import type { DiscussionView } from '../../../features/community/community.types';

export function DiscussionCard({
  discussion,
  onOpen,
}: {
  discussion: DiscussionView;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="block w-full text-left" onClick={onOpen}>
      <Card className="group p-5 transition hover:border-brand-200 hover:shadow-[0_8px_24px_rgba(19,70,134,.08)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{discussion.type}</Badge>
              <span className="text-xs text-muted">by {discussion.author.displayName}</span>
            </div>
            <h3 className="type-display text-lg font-bold text-ink group-hover:text-brand-700">
              {discussion.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{discussion.content}</p>
          </div>
          <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-muted">
          <MessageCircle className="h-4 w-4" /> {discussion.replyCount} replies
        </div>
      </Card>
    </button>
  );
}
