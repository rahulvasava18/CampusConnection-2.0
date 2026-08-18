import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthService } from '../../src/modules/identity/application/auth.service';

const app = createApp();
const frontendOrigin = 'http://localhost:5173';

function firstCookie(response: request.Response): string {
  const setCookie = response.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!cookie) throw new Error('Expected a Set-Cookie response header.');
  return cookie;
}

describe('CSRF bootstrap', () => {
  it('returns a token and sets the matching CSRF cookie', async () => {
    const response = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);

    expect(response.status).toBe(200);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(firstCookie(response)).toContain('cc_csrf=');
  });

  it('rejects a request with no CSRF cookie', async () => {
    const bootstrap = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);
    const token = bootstrap.body.data.csrfToken as string;

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('X-CSRF-Token', token);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects a request with no CSRF header', async () => {
    const bootstrap = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', firstCookie(bootstrap));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('rejects mismatched CSRF cookie and header values', async () => {
    const bootstrap = await request(app).get('/api/auth/csrf').set('Origin', frontendOrigin);

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', firstCookie(bootstrap))
      .set('X-CSRF-Token', 'invalid-token');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_TOKEN_INVALID');
  });

  it('allows a matching CSRF cookie and header', async () => {
    const authService = {
      refresh: async () => ({
        user: {},
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        csrfToken: 'rotated-csrf-token',
        sessionId: 'session-id',
      }),
    } as unknown as AuthService;
    const csrfApp = createApp({ authService });
    const bootstrap = await request(csrfApp).get('/api/auth/csrf').set('Origin', frontendOrigin);
    const token = bootstrap.body.data.csrfToken as string;

    const response = await request(csrfApp)
      .post('/api/auth/refresh')
      .set('Origin', frontendOrigin)
      .set('Cookie', firstCookie(bootstrap))
      .set('X-CSRF-Token', token);

    expect(response.status).toBe(200);
  });
});
