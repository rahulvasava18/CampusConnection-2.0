import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  MoreVertical,
  Send,
  Share2,
  ThumbsUp,
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPostView } from '@campusconnection/shared';
import { useAuthStore } from '../../auth/auth.store';
import {
  createComment,
  deletePost,
  getComments,
  togglePostReaction,
  updatePost,
} from '../social.api';
import { Avatar, Badge, Button, Card, TextareaField } from '../../../components/ui';
import { paginatedItems } from '../../../lib/api-state';

export function PostCard({
  post,
  onNavigate,
  onReport,
  onReportComment,
}: {
  post: SocialPostView;
  onNavigate?: (target: string) => void;
  onReport?: () => void;
  onReportComment?: (commentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((state) => state.user?.id);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const comments = useMutation({
    mutationFn: () => createComment(post.id, comment),
    onSuccess: () => {
      setComment('');
      void queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const reaction = useMutation({
    mutationFn: () => togglePostReaction(post.id, post.viewerHasReacted),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
  const edit = useMutation({
    mutationFn: () => updatePost(post.id, { content: editedContent }),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
  const listedComments = useInfiniteQuery({
    queryKey: ['comments', post.id],
    queryFn: ({ pageParam }) => getComments(post.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
    enabled: commentsOpen,
  });

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [menuOpen]);

  const sharePost = async () => {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.author.displayName} on CampusConnection`,
          text: post.content,
          url,
        });
        setShareState('shared');
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState('copied');
    } catch {
      setShareState('idle');
    }
    window.setTimeout(() => setShareState('idle'), 1800);
  };

  const categoryBadge = (
    <span className="theme-post-category bg-white" data-post-type={post.type}>
      <Badge tone={post.type === 'GENERAL' ? 'neutral' : 'brand'}>{post.type}</Badge>
    </span>
  );

  return (
    <Card className="overflow-visible rounded-[1.25rem] shadow-[0_8px_24px_rgba(32,55,59,.06)] transition-shadow hover:shadow-[0_12px_30px_rgba(43,87,145,.12)]">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <button
          type="button"
          className="-m-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:hover:bg-transparent"
          onClick={() => onNavigate?.(`/users/${post.author.id}/profile`)}
          disabled={!onNavigate}
          aria-label={`View ${post.author.displayName}'s profile`}
        >
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} />
          <span className="min-w-0">
            <span className="block truncate font-bold text-ink">{post.author.displayName}</span>
            <span className="mt-1 block truncate text-xs text-muted">
              @{post.author.username} · {new Date(post.createdAt).toLocaleString()} ·{' '}
              {post.visibility.toLowerCase()}
            </span>
          </span>
        </button>
        {viewerId === post.author.id || onReport ? (
          <div ref={menuRef} className="relative flex shrink-0 flex-row items-center gap-2">
            {categoryBadge}
            <button
              type="button"
              aria-label="Open post menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-10 z-20 grid min-w-36 gap-1 rounded-xl border border-line bg-white p-1.5 text-slate-700 shadow-lg">
                {viewerId === post.author.id ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-brand-50 hover:text-brand-800"
                      onClick={() => {
                        if (editing) edit.mutate();
                        else setEditing(true);
                        setMenuOpen(false);
                      }}
                      disabled={edit.isPending}
                    >
                      {editing ? 'Save post' : 'Edit post'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setMenuOpen(false);
                        if (window.confirm('Delete this post?')) remove.mutate();
                      }}
                      disabled={remove.isPending}
                    >
                      Delete post
                    </button>
                  </>
                ) : null}
                {onReport ? (
                  <button
                    type="button"
                    className="rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-brand-50 hover:text-brand-800"
                    onClick={() => {
                      setMenuOpen(false);
                      onReport();
                    }}
                  >
                    Report post
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          categoryBadge
        )}
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {editing ? (
          <TextareaField
            label="Edit post"
            aria-label="Edit post"
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{post.content}</p>
        )}
        {post.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
        {post.link ? (
          <a
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            href={post.link}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Open shared link
          </a>
        ) : null}
        {post.media?.length ? (
          <div className="space-y-2 overflow-hidden rounded-xl bg-slate-100">
            {post.media.map((asset, index) => (
              <a
                key={asset.id}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="group block bg-slate-100"
              >
                <img
                  src={asset.url}
                  alt={`Post attachment ${index + 1}`}
                  className="block h-auto max-h-[42rem] w-full object-contain transition group-hover:opacity-95"
                />
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-y border-line px-5 py-2 sm:px-6">
        <button
          type="button"
          aria-label={post.viewerHasReacted ? 'Unlike post' : 'Like post'}
          aria-pressed={post.viewerHasReacted}
          onClick={() => reaction.mutate()}
          disabled={reaction.isPending}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 ${post.viewerHasReacted ? 'text-brand-700' : 'text-slate-600'}`}
        >
          <ThumbsUp
            className="h-4 w-4 transition-transform active:scale-90"
            fill={post.viewerHasReacted ? 'currentColor' : 'none'}
          />
          {post.reactionCount}
        </button>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={commentsOpen}
          onClick={() => setCommentsOpen((open) => !open)}
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount} comments
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void sharePost()}>
          {shareState === 'copied' ? (
            <Check className="h-4 w-4" />
          ) : shareState === 'shared' ? (
            <Copy className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {shareState === 'copied' ? 'Copied' : shareState === 'shared' ? 'Shared' : 'Share'}
        </Button>
      </div>
      {commentsOpen ? (
        <div className="space-y-3 bg-slate-50/55 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-500" />
            <p className="type-ui text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Conversation
            </p>
          </div>
          {paginatedItems(listedComments.data?.pages).map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-sm text-slate-600">
              <p className="min-w-0 flex-1">
                <strong className="text-ink">{item.author.displayName}</strong> {item.content}
              </p>
              {onReportComment ? (
                <Button size="sm" variant="ghost" onClick={() => onReportComment(item.id)}>
                  Report
                </Button>
              ) : null}
            </div>
          ))}
          {!listedComments.isLoading && !paginatedItems(listedComments.data?.pages).length ? (
            <p className="text-sm text-muted">No comments yet. Start the conversation.</p>
          ) : null}
          {listedComments.hasNextPage ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void listedComments.fetchNextPage()}
              disabled={listedComments.isFetchingNextPage}
            >
              {listedComments.isFetchingNextPage ? 'Loading…' : 'Load more comments'}
            </Button>
          ) : null}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (comment.trim()) comments.mutate();
            }}
          >
            <input
              aria-label="Comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a thoughtful comment"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <Button type="submit" size="sm" disabled={comments.isPending}>
              <Send className="h-4 w-4" />
              Comment
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  );
}
