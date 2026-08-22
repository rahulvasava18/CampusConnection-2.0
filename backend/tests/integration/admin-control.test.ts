import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/shared/errors/app-error';
import { createApp } from '../../src/app';
import type { AdminControlService } from '../../src/modules/admin/application/admin-control.service';
import type { AdminAnalyticsService } from '../../src/modules/admin/application/admin-analytics.service';

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

describe('centralized admin control APIs', () => {
  it('accepts a validated report and keeps the target identifier opaque to the UI', async () => {
    const createReport = vi.fn().mockResolvedValue({ id: '507f1f77bcf86cd799439012', status: 'PENDING' });
    const app = createApp({ adminControlService: { createReport } as unknown as AdminControlService });
    const response = await request(app)
      .post('/api/reports')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'cc_csrf=csrf-token')
      .set('X-CSRF-Token', 'csrf-token')
      .send({ targetType: 'POST', targetId: '507f1f77bcf86cd799439012', reason: 'SPAM' });
    expect(response.status).toBe(201);
    expect(createReport).toHaveBeenCalledWith('507f1f77bcf86cd799439011', expect.objectContaining({ targetType: 'POST', reason: 'SPAM' }));
  });

  it('rejects a report with an invalid target id at the boundary', async () => {
    const createReport = vi.fn();
    const app = createApp({ adminControlService: { createReport } as unknown as AdminControlService });
    const response = await request(app).post('/api/reports').set('Origin', 'http://localhost:5173').set('Cookie', 'cc_csrf=csrf-token').set('X-CSRF-Token', 'csrf-token').send({ targetType: 'POST', targetId: 'not-an-object-id', reason: 'SPAM' });
    expect(response.status).toBe(422);
    expect(createReport).not.toHaveBeenCalled();
  });

  it('keeps the moderation queue behind the platform-admin role', async () => {
    const listReports = vi.fn().mockResolvedValue({ reports: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    const app = createApp({ adminControlService: { listReports } as unknown as AdminControlService, adminAnalyticsService: {} as AdminAnalyticsService });
    const normalUser = await request(app).get('/api/admin/reports');
    expect(normalUser.status).toBe(403);
    const administrator = await request(app).get('/api/admin/reports').set('x-admin', 'true');
    expect(administrator.status).toBe(200);
    expect(listReports).toHaveBeenCalled();
  });

  it('requires CSRF for moderation mutations', async () => {
    const reviewReport = vi.fn();
    const app = createApp({ adminControlService: { reviewReport } as unknown as AdminControlService });
    const response = await request(app).post('/api/admin/reports/507f1f77bcf86cd799439012/resolve').set('x-admin', 'true').send({ reason: 'Reviewed' });
    expect(response.status).toBe(403);
    expect(reviewReport).not.toHaveBeenCalled();
  });
});
