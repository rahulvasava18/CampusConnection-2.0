import { describe, expect, it } from 'vitest';
import {
  notificationCategoryForType,
  notificationTarget,
} from '../../src/modules/notifications/application/notification.service';
import { notificationQuery } from '../../src/modules/notifications/interfaces/notification.schemas';

describe('notification feature boundaries', () => {
  const id = '507f1f77bcf86cd799439011';

  it('maps domain events to stable notification categories', () => {
    expect(notificationCategoryForType('TEAM_INVITATION_SENT')).toBe('TEAMS');
    expect(notificationCategoryForType('TASK_ASSIGNED')).toBe('PROJECTS');
    expect(notificationCategoryForType('EVENT_CANCELLED')).toBe('EVENTS');
    expect(notificationCategoryForType('MESSAGE_SENT')).toBe('MESSAGES');
    expect(notificationCategoryForType('COMMENT_CREATED')).toBe('SOCIAL');
  });

  it('builds actionable deep links from event metadata', () => {
    expect(
      notificationTarget('TEAM_INVITATION_SENT', 'TEAM_INVITATION', id, { teamId: id }),
    ).toEqual({
      targetPath: `/teams/${id}`,
      actionLabel: 'Open Team',
    });
    expect(notificationTarget('EVENT_CANCELLED', 'EVENT', id)).toEqual({
      targetPath: `/events/${id}`,
      actionLabel: 'Open Event',
    });
    expect(notificationTarget('MESSAGE_SENT', 'MESSAGE', id)).toEqual({
      targetPath: '/messages',
      actionLabel: 'Open Messages',
    });
  });

  it('validates notification cursor and filter query boundaries', () => {
    expect(notificationQuery.safeParse({ limit: '20', filter: 'UNREAD' }).success).toBe(true);
    expect(notificationQuery.safeParse({ limit: '1000', filter: 'TEAMS' }).success).toBe(false);
    expect(notificationQuery.safeParse({ filter: 'UNKNOWN' }).success).toBe(false);
  });
});
