import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/modules/identity/application/auth.service';

describe('direct verification email dispatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends only after the signup transaction commits', async () => {
    let committed = false;
    const session = {
      withTransaction: vi.fn(async (work: () => Promise<void>) => {
        await work();
        committed = true;
      }),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as never);

    const emailService = {
      sendVerificationEmail: vi.fn(async () => {
        expect(committed).toBe(true);
      }),
    };
    const events = { record: vi.fn() };
    const service = new AuthService({
      users: {
        findByEmail: vi.fn().mockResolvedValue(null),
        findByUsername: vi.fn().mockResolvedValue(null),
      },
      pendingSignups: {
        deleteByCredentials: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue({ id: 'pending-signup-1', displayName: 'A Student' }),
      },
      rateLimiter: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      emailService,
      events,
    } as never);

    await expect(
      service.signup(
        {
          displayName: 'A Student',
          username: 'student1',
          email: 'student@example.com',
          password: 'password123',
        },
        { ipAddress: '127.0.0.1', requestId: 'request-1', correlationId: 'correlation-1' },
      ),
    ).resolves.toEqual({ email: 'student@example.com' });

    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@example.com',
        displayName: 'A Student',
        idempotencyKey: 'correlation-1',
      }),
    );
    expect(events.record).not.toHaveBeenCalled();
  });
});
