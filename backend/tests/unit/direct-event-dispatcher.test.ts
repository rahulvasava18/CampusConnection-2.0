import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleNotificationEvent: vi.fn().mockResolvedValue(undefined),
  invalidateUser: vi.fn().mockResolvedValue(undefined),
  refreshUserRecommendations: vi.fn().mockResolvedValue(undefined),
  analyticsUpdateOne: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../src/modules/notifications/application/notification.dispatcher', () => ({
  handleNotificationEvent: mocks.handleNotificationEvent,
}));
vi.mock('../../src/modules/intelligence/application/intelligence.service', () => ({
  IntelligenceService: class {
    invalidateUser = mocks.invalidateUser;
    refreshUserRecommendations = mocks.refreshUserRecommendations;
  },
}));
vi.mock('../../src/infrastructure/analytics/analytics-event.model', () => ({
  AnalyticsEventModel: { updateOne: mocks.analyticsUpdateOne },
}));

import { dispatchCoreEvents } from '../../src/infrastructure/events/direct-event-dispatcher';

function event(eventType: string) {
  return {
    eventId: `event-${eventType}`,
    eventType,
    eventVersion: 1,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    correlationId: 'correlation-1',
    aggregateType: 'Test',
    aggregateId: 'aggregate-1',
    actorId: 'actor-1',
    payload: {},
  } as never;
}

describe('direct core event dispatch', () => {
  beforeEach(() => {
    mocks.handleNotificationEvent.mockClear().mockResolvedValue(undefined);
    mocks.invalidateUser.mockClear().mockResolvedValue(undefined);
    mocks.refreshUserRecommendations.mockClear().mockResolvedValue(undefined);
    mocks.analyticsUpdateOne.mockClear().mockReturnValue({ exec: vi.fn().mockResolvedValue(undefined) });
  });

  it('dispatches user notifications without a worker', async () => {
    await dispatchCoreEvents([event('CONNECTION_REQUESTED')]);

    expect(mocks.handleNotificationEvent).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateUser).not.toHaveBeenCalled();
  });

  it('refreshes recommendation state directly for recommendation events', async () => {
    await dispatchCoreEvents([event('POST_CREATED')]);

    expect(mocks.invalidateUser).toHaveBeenCalledWith('actor-1');
    expect(mocks.refreshUserRecommendations).toHaveBeenCalledWith('actor-1');
    expect(mocks.handleNotificationEvent).not.toHaveBeenCalled();
  });
});
