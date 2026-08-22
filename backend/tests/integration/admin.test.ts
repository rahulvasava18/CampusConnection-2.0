import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/shared/errors/app-error';
import { createApp } from '../../src/app';
import type { AdminUserService } from '../../src/modules/admin/application/admin-user.service';

vi.mock('../../src/modules/identity/security/auth.middleware', () => ({
  requireAuth: (req: { auth?: unknown; header: (name: string) => string | undefined }, _res: unknown, next: () => void) => {
    const roles = req.header('x-admin') === 'true' ? ['PLATFORM_ADMIN'] : ['STUDENT'];
    req.auth = { userId: '507f1f77bcf86cd799439011', sessionId: 'session-id', familyId: 'family-id', roles, user: { accountState: 'ACTIVE' } };
    next();
  },
  requireRole: (...roles: string[]) => (req: { auth?: { roles: string[] } }, _res: unknown, next: (error?: unknown) => void) => {
    if (!req.auth || !req.auth.roles.some((role) => roles.includes(role))) {
      next(new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403));
      return;
    }
    next();
  },
}));

vi.mock('../../src/modules/admin/application/admin.service', () => ({
  AdminService: class {
    getStats = vi.fn().mockResolvedValue({ range: '30d', overview: {} });
  },
}));

describe('admin authorization boundary', () => {
  it('rejects an authenticated normal user', async () => {
    const response = await request(createApp()).get('/api/admin/stats');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('allows the platform-admin guard to reach the stats service', async () => {
    const response = await request(createApp()).get('/api/admin/stats').set('x-admin', 'true');
    expect(response.status).not.toBe(403);
  });

  it('lists users through the validated server-side admin query', async () => {
    const listUsers = vi.fn().mockResolvedValue({
      users: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    });
    const app = createApp({ adminUserService: { listUsers } as unknown as AdminUserService });
    const response = await request(app)
      .get('/api/admin/users?search=rahul&status=ACTIVE&limit=25')
      .set('x-admin', 'true');
    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'rahul', status: 'ACTIVE', limit: 25 }));
  });

  it('rejects invalid admin pagination at the API boundary', async () => {
    const response = await request(createApp()).get('/api/admin/users?limit=20').set('x-admin', 'true');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps moderation mutations behind CSRF and invokes the admin service', async () => {
    const warn = vi.fn().mockResolvedValue({ id: '507f1f77bcf86cd799439011' });
    const app = createApp({ adminUserService: { warn } as unknown as AdminUserService });
    const response = await request(app)
      .post('/api/admin/users/507f1f77bcf86cd799439012/warn')
      .set('x-admin', 'true')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'cc_csrf=csrf-token')
      .set('X-CSRF-Token', 'csrf-token')
      .send({ reason: 'Repeated spam', notifyUser: true });
    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledWith('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', { reason: 'Repeated spam', notifyUser: true }, expect.any(String));
  });
});
