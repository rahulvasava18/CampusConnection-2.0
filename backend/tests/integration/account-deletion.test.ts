import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthService } from '../../src/modules/identity/application/auth.service';

vi.mock('../../src/modules/identity/security/auth.middleware', () => ({
  requireAuth: (req: { auth?: unknown }, _res: unknown, next: () => void) => {
    req.auth = {
      userId: '507f1f77bcf86cd799439011',
      sessionId: 'session-id',
      familyId: 'family-id',
      roles: ['STUDENT'],
      user: { accountState: 'ACTIVE' },
    };
    next();
  },
}));

const authService = {} as AuthService;

describe('account deletion API', () => {
  it('requires the authenticated session and matching CSRF cookie/header', async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ authService, accountDeletionService: { deleteAccount } });

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'cc_csrf=csrf-token')
      .set('X-CSRF-Token', 'csrf-token');

    expect(response.status).toBe(204);
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('cc_refresh=')]),
    );
  });

  it('does not invoke deletion when the CSRF cookie is missing', async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const app = createApp({ authService, accountDeletionService: { deleteAccount } });

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Origin', 'http://localhost:5173')
      .set('X-CSRF-Token', 'csrf-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
