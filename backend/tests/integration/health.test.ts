import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { HealthService } from '../../src/application/health/health.service';

describe('Phase 1 health endpoints', () => {
  it('returns liveness under the API v1 base path', async () => {
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
