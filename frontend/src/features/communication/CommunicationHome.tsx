import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Trash2,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import type {
  ConversationView,
  MessageAcknowledgement,
  MessageSendPayload,
  MessageView,
  PresenceUpdate,
  SearchResult,
  TypingUpdate,
} from '@campusconnection/shared';
import { frontendEnv } from '../../lib/env';
import { useAuthStore } from '../auth/auth.store';
import { search } from '../discovery/discovery.api';
import {
  createCommunityConversation,
  createDirectConversation,
  createTeamConversation,
  deleteMessage,
  editMessage,
  getConversations,
  getMessages,
  markConversationRead,
} from './communication.api';
import { useCommunicationStore, type PendingMessage } from './communication.store';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  RestrictedState,
  cn,
} from '../../components/ui';
import { apiErrorMessage, collectionItems, isRestrictedApiError } from '../../lib/api-state';

function clientMessageId() {
  return crypto.randomUUID();
}

function conversationLabel(item: ConversationView) {
  return item.type === 'DIRECT'
    ? (item.peer?.displayName ?? item.title ?? 'Direct conversation')
    : (item.title ?? `${item.type.toLowerCase()} conversation`);
}

function conversationUsername(item: ConversationView) {
  return item.type === 'DIRECT' && item.peer?.username ? `@${item.peer.username}` : item.type;
}

function resultUsername(result: SearchResult) {
  const username = result.metadata.username;
  return typeof username === 'string' ? `@${username}` : undefined;
}

type ConversationFilter = 'ALL' | 'DIRECT' | 'GROUP' | 'TEAM' | 'COMMUNITY';

const conversationFilters: Array<{ value: ConversationFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'DIRECT', label: 'Direct' },
  { value: 'TEAM', label: 'Teams' },
  { value: 'COMMUNITY', label: 'Communities' },
  { value: 'GROUP', label: 'Groups' },
];

function conversationTypeLabel(type: ConversationView['type']) {
  switch (type) {
    case 'DIRECT':
      return 'Direct';
    case 'TEAM':
      return 'Team';
    case 'COMMUNITY':
      return 'Community';
    case 'GROUP':
      return 'Group';
  }
}

function formatConversationDate(value?: string) {
  if (!value) return 'No messages yet';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function messageDateKey(value: string) {
  return new Date(value).toDateString();
}

export function CommunicationHome({
  communityId,
  teamId,
  onNavigate,
}: {
  communityId?: string;
  teamId?: string;
  onNavigate?: (target: string) => void;
} = {}) {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const connection = useCommunicationStore((state) => state.connection);
  const pending = useCommunicationStore((state) => state.pending);
  const typing = useCommunicationStore((state) => state.typing);
  const presence = useCommunicationStore((state) => state.presence);
  const setConnection = useCommunicationStore((state) => state.setConnection);
  const addPending = useCommunicationStore((state) => state.addPending);
  const markFailed = useCommunicationStore((state) => state.markFailed);
  const removePending = useCommunicationStore((state) => state.removePending);
  const setTyping = useCommunicationStore((state) => state.setTyping);
  const setPresence = useCommunicationStore((state) => state.setPresence);
  const [selectedId, setSelectedId] = useState<string>();
  const [messageCursor, setMessageCursor] = useState<string>();
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [draft, setDraft] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [conversationQuery, setConversationQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('ALL');
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [editingContent, setEditingContent] = useState('');
  const [messageMenuId, setMessageMenuId] = useState<string>();
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string>();
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const previousScrollHeight = useRef<number | undefined>(undefined);
  const initialMessageLoad = useRef(true);

  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: () => getConversations(),
  });
  const peopleSearch = useQuery({
    queryKey: ['communication-people', peopleQuery.trim()],
    queryFn: () => search(peopleQuery.trim(), 'people'),
    enabled: !communityId && !teamId && peopleQuery.trim().length >= 2,
  });
  const messagesQuery = useQuery({
    queryKey: ['communication-messages', selectedId, messageCursor],
    queryFn: () => getMessages(selectedId!, messageCursor),
    enabled: Boolean(selectedId),
  });

  const directConversation = useMutation({
    mutationFn: (targetUserId: string) => createDirectConversation(targetUserId),
    onSuccess: (conversation) => {
      setPeopleQuery('');
      setSelectedId(conversation.id);
      queryClient.setQueryData(
        ['conversations'],
        (current: { data: ConversationView[] } | undefined) =>
          current
            ? {
                ...current,
                data: [conversation, ...current.data.filter((item) => item.id !== conversation.id)],
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const communityConversation = useMutation({
    mutationFn: () => createCommunityConversation(communityId!),
    onSuccess: (conversation) => {
      setSelectedId(conversation.id);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const teamConversation = useMutation({
    mutationFn: () => createTeamConversation(teamId!),
    onSuccess: (conversation) => {
      setSelectedId(conversation.id);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const messageEdit = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      editMessage(messageId, content),
    onSuccess: (updated) => {
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingMessageId(undefined);
      setEditingContent('');
      void queryClient.invalidateQueries({
        queryKey: ['communication-messages', updated.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const messageDelete = useMutation({
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: (_result, messageId) => {
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId
            ? { ...item, content: '', status: 'DELETED', deletedAt: new Date().toISOString() }
            : item,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['communication-messages', selectedId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const scopedConversationItems = collectionItems(conversations.data).filter((item) =>
    communityId
      ? item.type === 'COMMUNITY' && item.communityId === communityId
      : teamId
        ? item.type === 'TEAM' && item.teamId === teamId
        : true,
  );
  const conversationItems = scopedConversationItems.filter((item) => {
    const query = conversationQuery.trim().toLowerCase();
    const matchesFilter = conversationFilter === 'ALL' || item.type === conversationFilter;
    const matchesQuery =
      !query ||
      [conversationLabel(item), conversationUsername(item), item.lastMessagePreview, item.type]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));
    return matchesFilter && matchesQuery;
  });
  const realtimeAllowed = Boolean(user && ['ACTIVE', 'RESTRICTED'].includes(user.accountState));
  const selected = scopedConversationItems.find((item) => item.id === selectedId);
  const currentTyping = useMemo(
    () =>
      selectedId
        ? Object.values(typing).filter(
            (item) =>
              item.conversationId === selectedId && item.isTyping && item.userId !== user?.id,
          )
        : [],
    [selectedId, typing, user?.id],
  );

  useEffect(() => {
    if (!messagesQuery.data || messagesQuery.isFetching) return;
    setMessages((current) => {
      if (!messageCursor) return messagesQuery.data.data;
      const existingIds = new Set(current.map((item) => item.id));
      return [...current, ...messagesQuery.data.data.filter((item) => !existingIds.has(item.id))];
    });
  }, [messagesQuery.data, messagesQuery.isFetching, messageCursor]);

  useEffect(() => {
    setMessageCursor(undefined);
    setMessages([]);
    setDraft('');
    setEditingMessageId(undefined);
    setEditingContent('');
    setMessageMenuId(undefined);
    setDeleteConfirmationId(undefined);
    previousScrollHeight.current = undefined;
    initialMessageLoad.current = true;
  }, [selectedId]);

  useLayoutEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    if (initialMessageLoad.current && messages.length) {
      list.scrollTop = list.scrollHeight;
      initialMessageLoad.current = false;
      return;
    }
    if (previousScrollHeight.current === undefined) return;
    list.scrollTop += list.scrollHeight - previousScrollHeight.current;
    previousScrollHeight.current = undefined;
  }, [messages]);

  useEffect(() => {
    const last = messages[0];
    if (!selectedId || !last) return;
    void markConversationRead(selectedId, last.id).then(() =>
      queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    );
  }, [messages, queryClient, selectedId]);

  useEffect(() => {
    if (!token || !realtimeAllowed) {
      setConnection('disconnected');
      return;
    }
    setConnection('connecting');
    setRealtimeError(null);
    const socket = io(frontendEnv.VITE_REALTIME_URL, {
      autoConnect: false,
      transports: ['polling', 'websocket'],
      upgrade: true,
      auth: { accessToken: token },
    });
    socketRef.current = socket;
    socket.on('connect', () => {
      setRealtimeError(null);
      setConnection('connected');
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    socket.on('disconnect', (reason) =>
      setConnection(reason === 'io client disconnect' ? 'disconnected' : 'connecting'),
    );
    socket.on('connect_error', (error: Error) => {
      setRealtimeError(error.message);
      setConnection('connecting');
    });
    socket.on('message:new', (message: MessageView) => {
      removePending(message.clientMessageId);
      void queryClient.invalidateQueries({
        queryKey: ['communication-messages', message.conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    socket.on('message:updated', (message: MessageView) => {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
      void queryClient.invalidateQueries({
        queryKey: ['communication-messages', message.conversationId],
      });
    });
    socket.on('message:deleted', (message: MessageView) => {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
      void queryClient.invalidateQueries({
        queryKey: ['communication-messages', message.conversationId],
      });
    });
    socket.on('typing:update', (update: TypingUpdate) => setTyping(update));
    socket.on('presence:update', (update: PresenceUpdate) => setPresence(update));
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnection('disconnected');
    };
  }, [queryClient, removePending, setConnection, setPresence, setTyping, realtimeAllowed, token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedId || connection !== 'connected') return;
    socket.emit('conversation:join', { conversationId: selectedId });
    return () => {
      socket.emit('conversation:leave', { conversationId: selectedId });
    };
  }, [connection, selectedId]);

  const send = (message: PendingMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || connection !== 'connected') {
      markFailed(message.clientMessageId);
      return false;
    }
    const payload: MessageSendPayload = {
      conversationId: message.conversationId,
      clientMessageId: message.clientMessageId,
      content: message.content,
      messageType: 'TEXT',
    };
    socket.emit('message:send', payload, (ack: MessageAcknowledgement) => {
      if (ack.status === 'failed') markFailed(message.clientMessageId);
      else removePending(message.clientMessageId);
    });
    return true;
  };

  const submit = () => {
    if (!selectedId || !draft.trim()) return;
    const message: PendingMessage = {
      id: `pending-${clientMessageId()}`,
      conversationId: selectedId,
      senderId: user?.id ?? '',
      clientMessageId: clientMessageId(),
      content: draft.trim(),
      messageType: 'TEXT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      delivery: 'pending',
    };
    addPending(message);
    setDraft('');
    send(message);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!selectedId || !socketRef.current || connection !== 'connected') return;
    socketRef.current.emit('typing:start', { conversationId: selectedId });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () => socketRef.current?.emit('typing:stop', { conversationId: selectedId }),
      1000,
    );
  };

  const loadOlder = () => {
    const nextCursor = messagesQuery.data?.pagination.nextCursor;
    if (!nextCursor || messagesQuery.isFetching || !messageListRef.current) return;
    previousScrollHeight.current = messageListRef.current.scrollHeight;
    setMessageCursor(nextCursor);
  };

  const pendingForSelected = selectedId
    ? Object.values(pending).filter((item) => item.conversationId === selectedId)
    : [];
  const displayMessages: Array<MessageView | PendingMessage> = [...messages]
    .reverse()
    .concat(pendingForSelected);
  const people = peopleSearch.data?.data ?? [];

  return (
    <section className="page-theme page-theme-messages flex min-h-[calc(100vh-8.5rem)] flex-col gap-5">
      {communityId && !scopedConversationItems.length ? (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-ink">Community chat</h3>
              <p className="mt-1 text-sm text-muted">Start the #general conversation for this community.</p>
            </div>
            <Button onClick={() => communityConversation.mutate()} disabled={communityConversation.isPending}>
              {communityConversation.isPending ? 'Starting...' : 'Start chat'}
            </Button>
          </div>
        </Card>
      ) : null}
      {teamId && !scopedConversationItems.length ? (
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-ink">Team chat</h3>
              <p className="mt-1 text-sm text-muted">Start the #general conversation for this team.</p>
            </div>
            <Button onClick={() => teamConversation.mutate()} disabled={teamConversation.isPending}>
              {teamConversation.isPending ? 'Starting...' : 'Start chat'}
            </Button>
          </div>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Inbox</p>
          <p className="mt-1 text-sm text-muted">Direct, team, and community conversations in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={connection === 'connected' ? 'success' : 'warning'}>
            {connection === 'connected' ? <Wifi className="mr-1 inline h-3 w-3" /> : <WifiOff className="mr-1 inline h-3 w-3" />}
            {connection === 'connecting' ? 'reconnecting' : connection}
          </Badge>
          {realtimeError && realtimeAllowed ? (
            <Button size="sm" variant="secondary" onClick={() => socketRef.current?.connect()}>Reconnect</Button>
          ) : null}
        </div>
      </div>
      {realtimeError && realtimeAllowed ? <ErrorState message={`Realtime connection unavailable: ${realtimeError}`} /> : null}
      <div className="grid min-h-[32rem] flex-1 gap-4 lg:h-[calc(100vh-15rem)] lg:max-h-[44rem] lg:grid-cols-[21rem_1fr]">
        <Card className={cn('flex min-h-0 flex-col overflow-hidden p-3', selectedId && 'hidden lg:flex')}>
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <h3 className="font-display font-bold text-ink">Conversations</h3>
              <p className="mt-1 text-xs text-muted">{conversationItems.length} shown</p>
            </div>
            <Badge tone="neutral">{scopedConversationItems.filter((item) => item.unreadCount).length} unread</Badge>
          </div>
          {!communityId && !teamId ? (
            <div className="mb-3 rounded-xl border border-line bg-[var(--surface-secondary)] p-3">
              <Field
                label="New message"
                aria-label="Search people"
                value={peopleQuery}
                onChange={(event) => setPeopleQuery(event.target.value)}
                placeholder="Search by name or username"
              />
              {peopleSearch.isFetching ? <LoadingState label="Searching people" /> : null}
              {peopleSearch.error ? <p className="mt-2 text-xs text-red-600">{apiErrorMessage(peopleSearch.error, 'People search is unavailable.')}</p> : null}
              {directConversation.error ? <p className="mt-2 text-xs text-red-600">{apiErrorMessage(directConversation.error, 'Unable to start conversation.')}</p> : null}
              {peopleQuery.trim().length >= 2 && !peopleSearch.isFetching && !peopleSearch.error && !people.length ? <p className="mt-2 text-xs text-muted">No matching people found.</p> : null}
              <div className="mt-2 grid gap-2">
                {people.map((result) => (
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-[var(--surface-elevated)] px-2 py-2" key={`${result.type}-${result.id}`}>
                    <Avatar name={result.title} src={result.imageUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-xs text-ink">{result.title}</strong>
                      <span className="block truncate text-[11px] text-muted">{resultUsername(result) ?? 'Campus member'}</span>
                    </div>
                    <Button size="sm" onClick={() => directConversation.mutate(result.id)} disabled={!realtimeAllowed || directConversation.isPending}>
                      <MessageCircle className="h-3.5 w-3.5" />
                      Message
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <label className="relative mb-3 block px-1">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-slate-400" />
            <input
              aria-label="Search conversations"
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-xl border border-line bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10"
            />
          </label>
          <div className="mb-3 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Conversation filters">
            {conversationFilters.map((filter) => (
              <button
                type="button"
                key={filter.value}
                onClick={() => setConversationFilter(filter.value)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-brand-500',
                  conversationFilter === filter.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {conversations.isLoading ? <LoadingState label="Loading conversations" /> : null}
          {!realtimeAllowed || isRestrictedApiError(conversations.error) ? (
            <RestrictedState message="Verify your email before using conversations and realtime chat." />
          ) : conversations.error ? (
            <ErrorState message={apiErrorMessage(conversations.error, 'Unable to load conversations.')} onRetry={() => void conversations.refetch()} />
          ) : null}
          {realtimeAllowed && !conversations.isLoading && !conversations.error && !conversationItems.length ? (
            <EmptyState
              title={scopedConversationItems.length ? 'No matching conversations' : 'No conversations yet'}
              description={scopedConversationItems.length ? 'Try a different search or filter.' : 'Search for a student above to start a conversation.'}
            />
          ) : null}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {conversationItems.map((item) => {
              const isSelected = item.id === selectedId;
              const peerPresence = item.peer ? presence[item.peer.userId]?.state : undefined;
              return (
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-brand-500',
                    isSelected ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' : 'hover:bg-brand-50',
                  )}
                  onClick={() => setSelectedId(item.id)}
                  key={item.id}
                >
                  <Avatar name={conversationLabel(item)} src={item.peer?.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <strong className="block truncate text-sm">{conversationLabel(item)}</strong>
                      <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', isSelected ? 'bg-white/15 text-brand-100' : 'bg-slate-100 text-slate-500')}>
                        {conversationTypeLabel(item.type)}
                      </span>
                    </span>
                    <small className={cn('mt-1 block truncate text-xs', isSelected ? 'text-brand-100' : 'text-muted')}>
                      {item.lastMessagePreview ?? conversationUsername(item)}
                      {peerPresence === 'online' ? ' · online' : ''}
                    </small>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <small className={cn('text-[10px]', isSelected ? 'text-brand-100' : 'text-muted')}>
                      {formatConversationDate(item.lastMessageAt)}
                    </small>
                    {item.unreadCount ? <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.unreadCount}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card className={cn('flex min-h-0 flex-col overflow-hidden', !selectedId && 'hidden lg:flex')}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-4 sm:px-5">
                <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setSelectedId(undefined)}>
                  <ArrowLeft className="h-4 w-4" />
                  Inbox
                </Button>
                <Avatar name={conversationLabel(selected)} src={selected.peer?.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display font-bold text-ink">{conversationLabel(selected)}</h3>
                    <Badge tone="brand">{conversationTypeLabel(selected.type)}</Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                    <span>{conversationUsername(selected)}</span>
                    {selected.peer ? <span>· {presence[selected.peer.userId]?.state ?? 'offline'}</span> : null}
                    {currentTyping.length ? <span>· Someone is typing...</span> : null}
                  </p>
                </div>
                {selected.peer && onNavigate ? (
                  <Button size="sm" variant="secondary" onClick={() => onNavigate(`/users/${selected.peer?.userId}/profile`)}>
                    <UserRound className="h-4 w-4" />
                    <span className="hidden sm:inline">View profile</span>
                  </Button>
                ) : null}
                {messagesQuery.data?.pagination.hasMore ? (
                  <Button size="sm" variant="secondary" onClick={loadOlder} disabled={messagesQuery.isFetching}>
                    <ChevronDown className="h-4 w-4" />
                    Older
                  </Button>
                ) : null}
              </div>
              <div
                ref={messageListRef}
                className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-5"
                onScroll={(event) => {
                  if (event.currentTarget.scrollTop < 40) loadOlder();
                }}
              >
                {messagesQuery.isLoading ? <LoadingState label="Loading messages" /> : null}
                {messagesQuery.error ? <ErrorState message={apiErrorMessage(messagesQuery.error, 'Unable to load messages.')} onRetry={() => void messagesQuery.refetch()} /> : null}
                {!displayMessages.length && !messagesQuery.isLoading && !messagesQuery.error ? (
                  <EmptyState title="No messages yet" description="Send the first message to start the conversation." />
                ) : null}
                <div className="space-y-3">
                  {displayMessages.map((message, index) => {
                    const isPending = message.id.startsWith('pending-');
                    const pendingMessage = isPending ? (message as PendingMessage) : undefined;
                    const mine = message.senderId === user?.id;
                    const isEditing = editingMessageId === message.id;
                    const showDate = index === 0 || messageDateKey(message.createdAt) !== messageDateKey(displayMessages[index - 1]?.createdAt ?? message.createdAt);
                    const deleted = message.status === 'DELETED';
                    return (
                      <Fragment key={message.id}>
                        {showDate ? <div className="flex items-center gap-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400"><span className="h-px flex-1 bg-line" />{messageDateLabel(message.createdAt)}<span className="h-px flex-1 bg-line" /></div> : null}
                        <article
                          className={cn(
                            'group relative w-fit max-w-[min(85%,34rem)] rounded-[1.25rem] px-4 py-3 text-sm shadow-sm',
                            mine ? 'ml-auto rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-slate-700',
                            isPending && 'opacity-60',
                            deleted && 'italic text-slate-400',
                          )}
                        >
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea aria-label="Edit message" value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} className="w-full rounded-lg border border-white/30 bg-white/10 p-2 text-sm outline-none" />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => messageEdit.mutate({ messageId: message.id, content: editingContent.trim() })} disabled={!editingContent.trim() || messageEdit.isPending}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditingMessageId(undefined); setEditingContent(''); }}>Cancel</Button>
                              </div>
                            </div>
                          ) : <p className="whitespace-pre-wrap break-words">{message.content || 'Message deleted'}</p>}
                          <small className={cn('mt-2 flex items-center gap-1 text-xs', mine ? 'text-brand-100' : 'text-muted')}>
                            {mine ? 'You' : (selected.peer?.displayName ?? 'Member')} · {isPending ? pendingMessage?.delivery : formatMessageTime(message.createdAt)}
                            {!isPending && message.editedAt ? ' · edited' : ''}
                            {mine && !isPending && !deleted ? <Check className="h-3.5 w-3.5" aria-label="Sent" /> : null}
                          </small>
                          {mine && !isPending && !deleted && !isEditing ? (
                            <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                              <button type="button" aria-label="Message actions" className="rounded-lg p-1 text-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 hover:bg-white/10" onClick={() => setMessageMenuId(messageMenuId === message.id ? undefined : message.id)}>
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {messageMenuId === message.id ? (
                                <div className="absolute right-0 top-8 z-10 grid min-w-28 gap-1 rounded-xl border border-line bg-white p-1 text-slate-700 shadow-lg">
                                  <button type="button" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-brand-50" onClick={() => { setEditingMessageId(message.id); setEditingContent(message.content); setMessageMenuId(undefined); }}><Pencil className="h-3.5 w-3.5" />Edit</button>
                                  <button type="button" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50" onClick={() => { setDeleteConfirmationId(message.id); setMessageMenuId(undefined); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {deleteConfirmationId === message.id ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/10 p-2 text-xs not-italic">
                              <span>Delete this message?</span>
                              <button type="button" className="font-bold underline" onClick={() => { messageDelete.mutate(message.id); setDeleteConfirmationId(undefined); }} disabled={messageDelete.isPending}>Confirm</button>
                              <button type="button" className="underline" onClick={() => setDeleteConfirmationId(undefined)}>Cancel</button>
                            </div>
                          ) : null}
                          {isPending && pendingMessage?.delivery === 'failed' ? <button type="button" className="mt-2 text-xs font-bold underline" onClick={() => send(pendingMessage)}>Retry</button> : null}
                        </article>
                      </Fragment>
                    );
                  })}
                </div>
                {messageEdit.error || messageDelete.error ? <p className="mt-3 text-xs text-red-600">{apiErrorMessage(messageEdit.error ?? messageDelete.error, 'Unable to update the message.')}</p> : null}
              </div>
              <div className="border-t border-line bg-white p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    aria-label="Message"
                    value={draft}
                    rows={1}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    placeholder="Write a message..."
                    className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                  />
                  <Button onClick={submit} disabled={!draft.trim() || connection !== 'connected'}>
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted"><Clock3 className="h-3.5 w-3.5" /> Enter to send · Shift + Enter for a new line</p>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <MessageCircle className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-ink">Your inbox is ready</h3>
                <p className="mt-1 text-sm leading-6 text-muted">Select a conversation to read messages and reply in real time.</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
