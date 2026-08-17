import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';

describe('QA security boundaries', () => {
  const app = createApp();

  it('does not allow an arbitrary origin through credentialed CORS', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://attacker.invalid');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not emit submitted passwords in the response', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 42, password: 'not-a-real-password' });
    expect(response.status).toBe(422);
    expect(response.text).not.toMatch(/not-a-real-password/);
    expect(response.headers['set-cookie'] ?? []).toEqual([]);
  });

  it('handles an allowed CORS preflight without entering application routes', async () => {
    const response = await request(app)
      .options('/api/v1/feed')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(response.status).toBe(204);
  });
});
