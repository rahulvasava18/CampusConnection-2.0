import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const app = createApp();
const frontendOrigin = 'http://localhost:5173';

describe('CSRF bootstrap', () => {
  it('returns a token and sets the matching CSRF cookie', async () => {
    const response = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);
    const setCookie = response.headers['set-cookie'];

    expect(response.status).toBe(200);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(Array.isArray(setCookie) ? setCookie[0] : setCookie).toContain('cc_csrf=');
  });

  it('rejects an intentionally invalid token while preserving CSRF enforcement', async () => {
    const bootstrap = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);
    const bootstrapCookie = bootstrap.headers['set-cookie'];
    const cookie = Array.isArray(bootstrapCookie) ? bootstrapCookie[0] : bootstrapCookie;
    expect(cookie).toBeTruthy();

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', cookie!)
      .set('X-CSRF-Token', 'invalid-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });
});
