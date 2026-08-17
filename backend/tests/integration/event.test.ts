import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('event API authorization boundary', () => {
  it('requires authentication for event discovery and details', async () => {
    const app = createApp();
    const list = await request(app).get('/api/v1/events');
    const detail = await request(app).get('/api/v1/events/507f1f77bcf86cd799439011');
    expect(list.status).toBe(401);
    expect(detail.status).toBe(401);
  });

  it('does not accept unauthenticated event mutations', async () => {
    const app = createApp();
    const response = await request(app).post('/api/v1/events').send({});
    expect(response.status).toBe(401);
  });
});
