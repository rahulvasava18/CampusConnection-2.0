import { describe, expect, it } from 'vitest';
import {
  eventCreate,
  eventListQuery,
  eventRegistrationStatusUpdate,
  eventUpdate,
} from '../../src/modules/collaboration/interfaces/collaboration.schemas';

describe('event feature boundaries', () => {
  const base = {
    title: 'Campus Hackathon',
    description: 'A weekend build event for campus makers.',
    category: 'Hackathon',
    tags: ['AI', 'Web'],
    mode: 'OFFLINE' as const,
    venue: 'Main auditorium',
    startAt: '2030-09-20T10:00:00.000Z',
    endAt: '2030-09-20T18:00:00.000Z',
    registrationDeadline: '2030-09-19T23:59:59.000Z',
    capacity: 200,
    registrationRequired: true,
    visibility: 'PUBLIC' as const,
    rules: ['Bring your student ID'],
  };

  it('accepts a canonical event creation payload', () => {
    expect(eventCreate.safeParse(base).success).toBe(true);
  });

  it('enforces mode-specific location requirements and timing', () => {
    expect(
      eventCreate.safeParse({
        ...base,
        mode: 'ONLINE',
        venue: undefined,
        meetingLink: 'https://meet.example.com/event',
      }).success,
    ).toBe(true);
    expect(eventCreate.safeParse({ ...base, mode: 'ONLINE', venue: undefined }).success).toBe(
      false,
    );
    expect(eventCreate.safeParse({ ...base, endAt: '2030-09-20T09:00:00.000Z' }).success).toBe(
      false,
    );
    expect(eventUpdate.safeParse({ mode: 'HYBRID' }).success).toBe(true);
  });

  it('supports discovery filters and registration management states', () => {
    expect(
      eventListQuery.safeParse({
        limit: '20',
        status: 'UPCOMING',
        mode: 'ONLINE',
        available: 'true',
      }).success,
    ).toBe(true);
    expect(eventRegistrationStatusUpdate.safeParse({ status: 'ATTENDED' }).success).toBe(true);
    expect(eventRegistrationStatusUpdate.safeParse({ status: 'PENDING' }).success).toBe(false);
  });

  it('rejects unsupported visibility values', () => {
    expect(eventCreate.safeParse({ ...base, visibility: 'CONNECTIONS' }).success).toBe(false);
  });
});
