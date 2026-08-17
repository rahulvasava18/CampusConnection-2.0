import { useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  FolderKanban,
  MessageCircle,
  Network,
  Users,
} from 'lucide-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationCategory,
  NotificationFilter,
  NotificationView,
} from '@campusconnection/shared';
import { PageHeader } from '../../components/PageHeader';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  RestrictedState,
  cn,
} from '../../components/ui';
import {
  ApiRequestError,
  apiErrorMessage,
  collectionItems,
  isRestrictedApiError,
} from '../../lib/api-state';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../features/notifications/notifications.api';
import {
  getTeamInvitations,
  respondToTeamInvitation,
} from '../../features/collaboration/collaboration.api';
import {
  getConnectionRequests,
  getConnections,
  respondConnection,
} from '../../features/social/social.api';
import { getNotificationContent } from '../../features/notifications/notification-content';

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'TEAMS', label: 'Teams' },
  { value: 'PROJECTS', label: 'Projects' },
  { value: 'COMMUNITIES', label: 'Communities' },
  { value: 'EVENTS', label: 'Events' },
  { value: 'MESSAGES', label: 'Messages' },
];

function notificationIcon(category: NotificationCategory) {
  if (category === 'TEAMS') return Users;
  if (category === 'PROJECTS') return FolderKanban;
  if (category === 'COMMUNITIES') return Network;
  if (category === 'EVENTS') return CalendarDays;
  if (category === 'MESSAGES') return MessageCircle;
  return Bell;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).valueOf()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return 'Yesterday';
  return new Date(value).toLocaleDateString();
}

function sectionLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
}

export function Notifications({ onNavigate }: { onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('ALL');
  const notifications = useInfiniteQuery({
    queryKey: ['notifications', filter],
    queryFn: ({ pageParam }) => getNotifications(filter, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pagination.nextCursor ?? undefined,
  });
  const pendingInvitations = useQuery({
    queryKey: ['team-invitations'],
    queryFn: getTeamInvitations,
  });
  const acceptedConnections = useQuery({
    queryKey: ['connections'],
    queryFn: () => getConnections(50),
  });
  const incomingConnectionRequests = useQuery({
    queryKey: ['connection-requests', 'incoming'],
    queryFn: () => getConnectionRequests('incoming', 50),
  });
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
  const invitationResponse = useMutation({
    mutationFn: ({
      invitationId,
      accepted,
    }: {
      invitationId: string;
      accepted: boolean;
      teamId?: string;
    }) => respondToTeamInvitation(invitationId, accepted),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      if (variables.accepted) {
        const teamId = variables.teamId;
        if (teamId) onNavigate(`/teams/${teamId}`);
      }
    },
  });
  const [handledConnectionNotifications, setHandledConnectionNotifications] = useState<Set<string>>(
    () => new Set(),
  );
  const [connectionAction, setConnectionAction] = useState<{
    notificationId: string;
    accepted: boolean;
  } | null>(null);
  const [connectionErrors, setConnectionErrors] = useState<Record<string, string>>({});
  const connectionResponse = useMutation({
    mutationFn: ({
      requestId,
      accepted,
    }: {
      requestId: string;
      notificationId: string;
      accepted: boolean;
      readAt?: string;
    }) => respondConnection(requestId, accepted),
    onSuccess: (_result, variables) => {
      setHandledConnectionNotifications((current) => {
        const next = new Set(current);
        next.add(variables.notificationId);
        return next;
      });
      setConnectionErrors((current) => {
        const next = { ...current };
        delete next[variables.notificationId];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['connections'] });
      void queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      if (!variables.readAt) markRead.mutate(variables.notificationId);
    },
    onError: (error, variables) => {
      if (error instanceof ApiRequestError && error.status === 409) {
        setHandledConnectionNotifications((current) => {
          const next = new Set(current);
          next.add(variables.notificationId);
          return next;
        });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        if (!variables.readAt) markRead.mutate(variables.notificationId);
        return;
      }
      setConnectionErrors((current) => ({
        ...current,
        [variables.notificationId]: apiErrorMessage(
          error,
          'The connection request could not be updated.',
        ),
      }));
    },
    onSettled: () => setConnectionAction(null),
  });
  const items = useMemo(
    () => notifications.data?.pages.flatMap((page) => page.data) ?? [],
    [notifications.data],
  );
  const unread = items.filter((item) => !item.readAt).length;
  const invitationActionPending = markRead.isPending || invitationResponse.isPending;
  const connectionActionPending = markRead.isPending || connectionResponse.isPending;
  const notificationPath = (item: NotificationView) =>
    item.type === 'CONNECTION_REQUESTED' && item.actorId
      ? `/users/${item.actorId}/profile`
      : item.targetPath;
  const openNotification = (item: NotificationView) => {
    const open = () => onNavigate(notificationPath(item));
    if (item.readAt) open();
    else markRead.mutate(item.id, { onSuccess: open });
  };
  const teamInvitationId = (item: NotificationView) =>
    item.type === 'TEAM_INVITATION_SENT' ? item.entityId : undefined;
  const teamIdForInvitation = (item: NotificationView) => {
    const value = item.metadata?.teamId;
    return typeof value === 'string' ? value : undefined;
  };
  const pendingInvitationIds = new Set(
    collectionItems(pendingInvitations.data).map((item) => item.id),
  );
  const openTeamInvitation = (item: NotificationView) => {
    const teamId = teamIdForInvitation(item);
    if (!teamId) return;
    const open = () => onNavigate(`/teams/${teamId}?from=invitation`);
    if (item.readAt) open();
    else markRead.mutate(item.id, { onSuccess: open });
  };
  const respondToInvitation = (item: NotificationView, accepted: boolean) => {
    const invitationId = teamInvitationId(item);
    const teamId = teamIdForInvitation(item);
    if (!invitationId) return;
    const respond = () =>
      invitationResponse.mutate({ invitationId, accepted, ...(teamId ? { teamId } : {}) });
    if (item.readAt) respond();
    else markRead.mutate(item.id, { onSuccess: respond });
  };
  const connectionRequestId = (item: NotificationView) => {
    const value = item.metadata?.connectionId;
    return typeof value === 'string' ? value : item.entityId;
  };
  const relationshipListsComplete =
    !acceptedConnections.isLoading &&
    !incomingConnectionRequests.isLoading &&
    !acceptedConnections.error &&
    !incomingConnectionRequests.error &&
    !acceptedConnections.data?.pagination.hasMore &&
    !incomingConnectionRequests.data?.pagination.hasMore;
  const acceptedConnectionIds = new Set(
    collectionItems(acceptedConnections.data).map((item) => item.id),
  );
  const incomingConnectionIds = new Set(
    collectionItems(incomingConnectionRequests.data).map((item) => item.id),
  );
  const isConnectionHandled = (item: NotificationView) => {
    if (handledConnectionNotifications.has(item.id)) return true;
    if (!relationshipListsComplete) return false;
    const requestId = connectionRequestId(item);
    return acceptedConnectionIds.has(requestId) || !incomingConnectionIds.has(requestId);
  };
  const respondToConnection = (item: NotificationView, accepted: boolean) => {
    if (connectionActionPending || handledConnectionNotifications.has(item.id)) return;
    setConnectionAction({ notificationId: item.id, accepted });
    connectionResponse.mutate({
      requestId: connectionRequestId(item),
      notificationId: item.id,
      accepted,
      ...(item.readAt ? { readAt: item.readAt } : {}),
    });
  };

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Notifications"
        title="Your notifications."
        description="Stay updated with activity that matters to you."
        action={
          unread ? (
            <Badge tone="brand">{unread} unread</Badge>
          ) : (
            <Badge tone="success">All caught up</Badge>
          )
        }
      />
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification filters">
            {filters.map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                className={cn(
                  'rounded-full px-3.5 py-2 text-xs font-bold transition',
                  filter === item.value
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700',
                )}
                key={item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => markAllRead.mutate()}
            disabled={!unread || markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </Card>
      {notifications.isLoading ? <LoadingState label="Loading notifications" /> : null}
      {isRestrictedApiError(notifications.error) ? (
        <RestrictedState message="Verify your email to access notifications." />
      ) : null}
      {notifications.error && !isRestrictedApiError(notifications.error) ? (
        <ErrorState
          message={apiErrorMessage(
            notifications.error,
            'Notifications are temporarily unavailable.',
          )}
          onRetry={() => void notifications.refetch()}
        />
      ) : null}
      {!notifications.isLoading && !notifications.error && !items.length ? (
        <EmptyState
          title={filter === 'UNREAD' ? 'No unread notifications' : 'You’re all caught up'}
          description="New activity and important updates will appear here."
        />
      ) : null}
      {!notifications.isLoading && !notifications.error && items.length ? (
        <div className="space-y-5">
          {(['Today', 'Yesterday', 'Earlier'] as const).map((group) => {
            const grouped = items.filter((item) => sectionLabel(item.createdAt) === group);
            if (!grouped.length) return null;
            return (
              <section className="space-y-2" key={group}>
                <h2 className="type-ui px-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-600">
                  {group}
                </h2>
                <div className="grid gap-2">
                  {grouped.map((item) => {
                    const Icon = notificationIcon(item.category);
                    const content = getNotificationContent(item);
                    const teamId = teamIdForInvitation(item);
                    const isTeamInvitation =
                      item.type === 'TEAM_INVITATION_SENT' && Boolean(teamId);
                    const isConnectionRequest =
                      item.type === 'CONNECTION_REQUESTED' && Boolean(item.actorId);
                    const connectionHandled = isConnectionHandled(item);
                    const actionIsAccepting =
                      connectionAction?.notificationId === item.id && connectionAction.accepted;
                    const actionIsRejecting =
                      connectionAction?.notificationId === item.id && !connectionAction.accepted;
                    const invitationPending =
                      isTeamInvitation &&
                      (!pendingInvitations.data || pendingInvitationIds.has(item.entityId));
                    return (
                      <article
                        className={cn(
                          'flex items-start gap-3 rounded-2xl border px-4 py-4 transition',
                          item.readAt
                            ? 'border-line bg-white'
                            : 'border-brand-100 bg-brand-50/50 shadow-sm',
                        )}
                        key={item.id}
                      >
                        <span
                          className={cn(
                            'mt-0.5 rounded-xl p-2.5',
                            item.readAt ? 'bg-slate-100 text-slate-500' : 'bg-white text-brand-600',
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p
                              className={cn(
                                'text-sm leading-6',
                                item.readAt ? 'font-medium text-slate-700' : 'font-bold text-ink',
                              )}
                            >
                              {content.title}
                            </p>
                            {!item.readAt ? (
                              <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                                aria-label="Unread"
                              />
                            ) : null}
                          </div>
                          {item.body ? (
                            <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-400">
                            {relativeTime(item.createdAt)}
                          </p>
                          {isConnectionRequest && !connectionHandled ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openNotification(item)}
                                disabled={connectionActionPending}
                              >
                                View Profile
                              </Button>
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => respondToConnection(item, true)}
                                disabled={connectionActionPending}
                              >
                                {actionIsAccepting ? 'Accepting…' : 'Accept'}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => respondToConnection(item, false)}
                                disabled={connectionActionPending}
                              >
                                {actionIsRejecting ? 'Rejecting…' : 'Reject'}
                              </Button>
                              {connectionErrors[item.id] ? (
                                <p className="basis-full text-xs font-semibold text-red-700">
                                  {connectionErrors[item.id]}
                                </p>
                              ) : null}
                            </div>
                          ) : isConnectionRequest ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openNotification(item)}
                              >
                                View Profile
                              </Button>
                              <span className="text-xs font-semibold text-muted">
                                Request handled
                              </span>
                            </div>
                          ) : isTeamInvitation && invitationPending ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openTeamInvitation(item)}
                                disabled={invitationActionPending}
                              >
                                Open Team
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => respondToInvitation(item, true)}
                                disabled={invitationActionPending}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => respondToInvitation(item, false)}
                                disabled={invitationActionPending}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : isTeamInvitation ? (
                            <p className="mt-2 text-xs font-semibold text-muted">
                              Invitation handled
                            </p>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 px-0"
                              onClick={() => openNotification(item)}
                            >
                              {item.actionLabel}
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {notifications.hasNextPage ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void notifications.fetchNextPage()}
              disabled={notifications.isFetchingNextPage}
            >
              {notifications.isFetchingNextPage ? 'Loading…' : 'Load more notifications'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
