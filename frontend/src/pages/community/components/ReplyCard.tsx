import { Avatar } from '../../../components/ui';
import type { ReplyView } from '../../../features/community/community.types';

export function ReplyCard({ reply }: { reply: ReplyView }) {
  return (
    <article className="flex gap-3 border-b border-line py-4 last:border-0">
      <Avatar name={reply.author.displayName} src={reply.author.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">
          {reply.author.displayName}{' '}
          <span className="text-xs font-normal text-muted">@{reply.author.username}</span>
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{reply.content}</p>
      </div>
    </article>
  );
}
