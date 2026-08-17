import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { HealthService } from '../../src/application/health/health.service';

describe('health endpoints', () => {
  it('returns the public service status at the root endpoint', async () => {
    const app = createApp();
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ service: 'CampusConnection API', status: 'ok' });
  });

  it('supports HEAD at the public root endpoint through the GET route', async () => {
    const app = createApp();
    const response = await request(app).head('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
  });

  it('returns liveness under the API base path', async () => {
    const app = createApp({
      healthService: new HealthService(
        () => true,
        () => true,
        'test-api',
      ),
    });
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('reports dependency readiness accurately', async () => {
    const app = createApp({
      healthService: new HealthService(
        () => true,
        () => false,
        'test-api',
      ),
    });
    const response = await request(app).get('/api/ready');
    expect(response.status).toBe(503);
    expect(response.body.data.status).toBe('not_ready');
    expect(response.body.data.dependencies.redis.status).toBe('down');
  });
});
