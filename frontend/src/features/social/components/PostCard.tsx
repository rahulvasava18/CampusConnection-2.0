import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { ApiCollection, SocialCommentView, SocialPostView } from '@campusconnection/shared';
import { useAuthStore } from '../../auth/auth.store';
import {
  createComment,
  deleteComment,
  deletePost,
  getComments,
  toggleCommentReaction,
  togglePostReaction,
  updateComment,
  updatePost,
} from '../social.api';
import { Avatar, Badge, Button, Card, TextareaField } from '../../../components/ui';
import { apiErrorMessage, paginatedItems } from '../../../lib/api-state';

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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [commentActionError, setCommentActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const comments = useMutation({
    mutationFn: (input: { content: string; parentCommentId?: string }) =>
      createComment(post.id, input.content, input.parentCommentId),
    onSuccess: (created) => {
      setComment('');
      setReplyContent('');
      setReplyingTo(null);
      setCommentActionError(null);
      queryClient.setQueryData<InfiniteData<ApiCollection<SocialCommentView>>>(
        ['comments', post.id],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page, index) =>
                  index === 0 ? { ...page, data: [created, ...page.data] } : page,
                ),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => setCommentActionError(apiErrorMessage(error, 'Comment could not be posted.')),
  });
  const commentEdit = useMutation({
    mutationFn: (input: { commentId: string; content: string }) =>
      updateComment(input.commentId, input.content),
    onSuccess: (updated) => {
      setEditingCommentId(null);
      setEditedCommentContent('');
      setCommentActionError(null);
      queryClient.setQueryData<InfiniteData<ApiCollection<SocialCommentView>>>(
        ['comments', post.id],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  data: page.data.map((item) => (item.id === updated.id ? updated : item)),
                })),
              }
            : current,
      );
    },
    onError: (error) => setCommentActionError(apiErrorMessage(error, 'Comment could not be updated.')),
  });
  const commentDelete = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_result, commentId) => {
      setCommentActionError(null);
      queryClient.setQueryData<InfiniteData<ApiCollection<SocialCommentView>>>(
        ['comments', post.id],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  data: page.data.filter((item) => item.id !== commentId),
                })),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['comments', post.id] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => setCommentActionError(apiErrorMessage(error, 'Comment could not be deleted.')),
  });
  const commentReaction = useMutation({
    mutationFn: (input: { commentId: string; reacted: boolean }) =>
      toggleCommentReaction(input.commentId, input.reacted),
    onSuccess: (_result, input) => {
      setCommentActionError(null);
      queryClient.setQueryData<InfiniteData<ApiCollection<SocialCommentView>>>(
        ['comments', post.id],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  data: page.data.map((item) =>
                    item.id === input.commentId
                      ? {
                          ...item,
                          viewerHasReacted: !input.reacted,
                          reactionCount: Math.max(
                            0,
                            item.reactionCount + (input.reacted ? -1 : 1),
                          ),
                        }
                      : item,
                  ),
                })),
              }
            : current,
      );
    },
    onError: (error) => setCommentActionError(apiErrorMessage(error, 'Comment reaction failed.')),
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
  const commentItems = paginatedItems(listedComments.data?.pages);
  const { topLevelComments, repliesByParent } = useMemo(() => {
    const knownIds = new Set(commentItems.map((item) => item.id));
    const replies = new Map<string, SocialCommentView[]>();
    for (const item of commentItems) {
      if (!item.parentCommentId) continue;
      const current = replies.get(item.parentCommentId) ?? [];
      current.push(item);
      replies.set(item.parentCommentId, current);
    }
    return {
      topLevelComments: commentItems.filter(
        (item) => !item.parentCommentId || !knownIds.has(item.parentCommentId),
      ),
      repliesByParent: replies,
    };
  }, [commentItems]);

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

  const renderComment = (item: SocialCommentView, depth = 0) => {
    const isOwner = viewerId === item.author.id;
    const isEditing = editingCommentId === item.id;
    const isReplying = replyingTo === item.id;
    const edited = item.updatedAt !== item.createdAt;
    const nested = depth > 0;
    const childComments = repliesByParent.get(item.id) ?? [];
    return (
      <div
        key={item.id}
        className={nested ? 'ml-8 border-l border-line pl-4 sm:ml-12' : ''}
      >
        <div className="flex items-start gap-2">
          <Avatar name={item.author.displayName} src={item.author.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <strong className="text-sm text-ink">{item.author.displayName}</strong>
              <span className="text-xs text-muted">@{item.author.username}</span>
              <span className="text-xs text-muted">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <TextareaField
                  label="Edit comment"
                  aria-label="Edit comment"
                  value={editedCommentContent}
                  onChange={(event) => setEditedCommentContent(event.target.value)}
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const content = editedCommentContent.trim();
                      if (content) commentEdit.mutate({ commentId: item.id, content });
                    }}
                    disabled={commentEdit.isPending || !editedCommentContent.trim()}
                  >
                    {commentEdit.isPending ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditedCommentContent('');
                    }}
                    disabled={commentEdit.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {item.content}{' '}
                {edited ? <span className="text-xs text-muted">(edited)</span> : null}
              </p>
            )}
            {!isEditing ? (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-8 px-2 py-1 text-xs"
                  onClick={() =>
                    commentReaction.mutate({
                      commentId: item.id,
                      reacted: item.viewerHasReacted,
                    })
                  }
                  disabled={commentReaction.isPending}
                  aria-pressed={item.viewerHasReacted}
                >
                  {item.viewerHasReacted ? 'Unlike' : 'Like'} · {item.reactionCount}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-8 px-2 py-1 text-xs"
                  onClick={() => {
                    setReplyingTo(isReplying ? null : item.id);
                    setReplyContent('');
                    setCommentActionError(null);
                  }}
                >
                  Reply
                </Button>
                {isOwner ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs"
                      onClick={() => {
                        setEditingCommentId(item.id);
                        setEditedCommentContent(item.content);
                        setCommentActionError(null);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-8 px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        if (window.confirm('Delete this comment?')) commentDelete.mutate(item.id);
                      }}
                      disabled={commentDelete.isPending}
                    >
                      {commentDelete.isPending ? 'Deleting…' : 'Delete'}
                    </Button>
                  </>
                ) : null}
                {onReportComment ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-8 px-2 py-1 text-xs"
                    onClick={() => onReportComment(item.id)}
                  >
                    Report
                  </Button>
                ) : null}
              </div>
            ) : null}
            {isReplying ? (
              <form
                className="mt-2 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const content = replyContent.trim();
                  if (content) comments.mutate({ content, parentCommentId: item.id });
                }}
              >
                <TextareaField
                  label={`Reply to ${item.author.displayName}`}
                  aria-label={`Reply to ${item.author.displayName}`}
                  value={replyContent}
                  onChange={(event) => setReplyContent(event.target.value)}
                  placeholder="Write a reply…"
                  rows={2}
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" type="submit" disabled={comments.isPending || !replyContent.trim()}>
                    {comments.isPending ? 'Replying…' : 'Reply'}
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                    disabled={comments.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
        {childComments.map((child) => renderComment(child, Math.min(depth + 1, 2)))}
      </div>
    );
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
              Comment Section
            </p>
          </div>
          {listedComments.isLoading ? (
            <p className="text-sm text-muted" role="status">
              Loading comments…
            </p>
          ) : null}
          {listedComments.error ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-600">
                {apiErrorMessage(listedComments.error, 'Comments could not be loaded.')}
              </p>
              <Button size="sm" variant="secondary" onClick={() => void listedComments.refetch()}>
                Retry comments
              </Button>
            </div>
          ) : null}
          {!listedComments.isLoading && !listedComments.error
            ? topLevelComments.map((item) => (
                <div key={item.id} className="space-y-2">
                  {renderComment(item)}
                </div>
              ))
            : null}
          {!listedComments.isLoading && !listedComments.error && !commentItems.length ? (
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
              const content = comment.trim();
              if (content) comments.mutate({ content });
            }}
          >
            <input
              aria-label="Comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Add a thoughtful comment"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
            <Button type="submit" size="sm" disabled={comments.isPending || !comment.trim()}>
              <Send className="h-4 w-4" />
              {comments.isPending ? 'Posting…' : 'Comment'}
            </Button>
          </form>
          {commentActionError ? (
            <p className="text-sm font-semibold text-red-600" role="alert">
              {commentActionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
