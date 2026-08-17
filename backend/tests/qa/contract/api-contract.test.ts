import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';

const app = createApp();
const id = '507f1f77bcf86cd799439011';

describe('QA API contract and authorization matrix', () => {
  it.each([
    ['/api/feed', 'get'],
    ['/api/communities', 'get'],
    ['/api/teams', 'get'],
    ['/api/projects', 'get'],
    ['/api/events', 'get'],
    ['/api/search?q=campus', 'get'],
    ['/api/conversations', 'get'],
    ['/api/notifications', 'get'],
    ['/api/settings', 'get'],
    ['/api/recommendations/people', 'get'],
    [`/api/users/${id}/profile`, 'get'],
  ] as const)('rejects anonymous access to %s', async (path, method) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('keeps the public API envelope and security headers stable', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { status: 'ok' } });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('returns a structured 404 for unknown API routes', async () => {
    const response = await request(app).get('/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });

  it('rejects malformed public payloads at the request boundary', async () => {
    const response = await request(app).post('/api/auth/login').send({ identifier: 42 });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.issues.length).toBeGreaterThan(0);
  });

  it('requires CSRF protection for cookie-authenticated mutations', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });
});
