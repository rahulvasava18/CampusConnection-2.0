import type { NotificationView } from '@campusconnection/shared';

export type NotificationContent = {
  title: string;
};

function metadataText(notification: NotificationView, key: string): string | undefined {
  const value = notification.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function actorName(notification: NotificationView): string | undefined {
  return (
    metadataText(notification, 'actorDisplayName') ??
    metadataText(notification, 'actorUsername')
  );
}

function entityName(notification: NotificationView): string | undefined {
  return metadataText(notification, 'entityName');
}

export function getNotificationContent(notification: NotificationView): NotificationContent {
  const actor = actorName(notification);
  const entity = entityName(notification);

  if (notification.type === 'CONNECTION_REQUESTED' && actor)
    return { title: `${actor} sent you a connection request` };
  if (notification.type === 'CONNECTION_ACCEPTED' && actor)
    return { title: `${actor} accepted your connection request` };
  if (notification.type === 'MESSAGE_SENT' && actor)
    return { title: `New message from ${actor}` };
  if (notification.type === 'COMMUNITY_JOINED' && actor && entity)
    return { title: `${actor} joined ${entity}` };
  if (notification.type === 'TEAM_INVITATION_SENT' && actor && entity)
    return { title: `${actor} invited you to join ${entity}` };
  if (notification.type === 'PROJECT_INVITATION_SENT' && actor && entity)
    return { title: `${actor} invited you to collaborate on ${entity}` };
  if (notification.type === 'COMMUNITY_INVITATION_SENT' && actor && entity)
    return { title: `${actor} invited you to join ${entity}` };
  if (notification.type === 'TEAM_MEMBER_JOINED' && actor && entity)
    return { title: `${actor} joined ${entity}` };
  if (notification.type === 'TEAM_JOIN_REQUESTED' && actor && entity)
    return { title: `${actor} requested to join ${entity}` };
  if (notification.type === 'PROJECT_JOIN_REQUESTED' && actor && entity)
    return { title: `${actor} requested to join ${entity}` };
  if (notification.type === 'EVENT_REGISTRATION_CONFIRMED' && entity)
    return { title: `Your registration for ${entity} was confirmed` };
  if (notification.type === 'EVENT_REGISTRATION_CANCELLED' && entity)
    return { title: `Your registration for ${entity} was cancelled` };
  if (notification.type === 'EVENT_UPDATED' && entity)
    return { title: `${entity} was updated` };
  if (notification.type === 'EVENT_CANCELLED' && entity)
    return { title: `${entity} was cancelled` };
  if (notification.type === 'EVENT_ARCHIVED' && entity)
    return { title: `${entity} was archived` };
  if (notification.type === 'TEAM_UPDATED' && entity)
    return { title: `${entity} was updated` };
  if (notification.type === 'TEAM_COMPLETED' && entity)
    return { title: `${entity} was completed` };
  if (notification.type === 'PROJECT_UPDATED' && entity)
    return { title: `${entity} was updated` };
  if (notification.type === 'PROJECT_COMPLETED' && entity)
    return { title: `${entity} was completed` };
  if (notification.type === 'COMMUNITY_UPDATED' && entity)
    return { title: `${entity} was updated` };
  if (notification.type === 'REACTION_ADDED' && actor)
    return { title: `${actor} liked your post or comment` };
  if (notification.type === 'COMMENT_CREATED' && actor)
    return { title: `${actor} commented on your post` };
  if (notification.type === 'REPLY_CREATED' && actor)
    return { title: `${actor} replied to your discussion` };

  return { title: notification.title };
}
