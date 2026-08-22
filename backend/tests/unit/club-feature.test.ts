import { describe, expect, it } from 'vitest';
import { adminClubStatus, clubCreate, clubEventCreate, clubInvite, clubListQuery } from '../../src/modules/club/interfaces/club.schemas';

describe('club feature boundaries', () => {
  const event = {
    title: 'Club workshop', description: 'A verified club event.', category: 'Technical', tags: [], mode: 'OFFLINE' as const, venue: 'Auditorium', startAt: '2030-09-20T10:00:00.000Z', endAt: '2030-09-20T12:00:00.000Z', registrationRequired: true, registrationUrl: 'https://forms.example.com/register', visibility: 'PUBLIC' as const, rules: [],
  };

  it('validates a club application and lifecycle filters', () => {
    expect(clubCreate.safeParse({ name: 'Nirma Coding Club', slug: 'nirma-coding-club', description: 'Build together.', category: 'Technical', contactEmail: 'club@example.com', privacy: 'PUBLIC' }).success).toBe(true);
    expect(clubListQuery.safeParse({ limit: '20', status: 'PENDING', privacy: 'PRIVATE' }).success).toBe(true);
    expect(adminClubStatus.safeParse({ status: 'REJECTED', reason: 'Needs more information.' }).success).toBe(true);
  });

  it('requires an external registration URL for club events', () => {
    expect(clubEventCreate.safeParse(event).success).toBe(true);
    expect(clubEventCreate.safeParse({ ...event, registrationUrl: undefined }).success).toBe(false);
    expect(clubEventCreate.safeParse({ ...event, registrationRequired: false, registrationUrl: undefined }).success).toBe(true);
    expect(clubEventCreate.safeParse({ ...event, endAt: '2030-09-20T09:00:00.000Z' }).success).toBe(false);
    expect(clubEventCreate.safeParse({ ...event, registrationDeadline: '2030-09-20T11:00:00.000Z' }).success).toBe(false);
  });

  it('keeps invitations bound to MongoDB user identifiers', () => {
    expect(clubInvite.safeParse({ inviteeId: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(clubInvite.safeParse({ inviteeId: 'virat_18' }).success).toBe(false);
  });
});
