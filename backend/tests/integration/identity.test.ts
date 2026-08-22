import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { AuthService } from '../../src/modules/identity/application/auth.service';

const app = createApp();

describe('password identity API', () => {
  it('keeps the refresh endpoint behind CSRF validation', async () => {
    const response = await request(app).post('/api/auth/refresh');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('validates signup and login payloads at the public boundary', async () => {
    const signup = await request(app).post('/api/auth/signup').send({});
    expect(signup.status).toBe(422);
    expect(signup.body.error.code).toBe('VALIDATION_ERROR');

    const login = await request(app).post('/api/auth/login').send({});
    expect(login.status).toBe(422);
    expect(login.body.error.code).toBe('VALIDATION_ERROR');

    const googleExchange = await request(app).post('/api/auth/google/exchange').send({});
    expect(googleExchange.status).toBe(422);
    expect(googleExchange.body.error.code).toBe('VALIDATION_ERROR');

    const legacySignup = await request(app).post('/api/auth/signup').send({
      displayName: 'Legacy User',
      username: 'legacy_user',
      email: 'legacy@example.com',
      password: 'a-secure-password',
    });
    expect(legacySignup.status).toBe(410);
    expect(legacySignup.body.error.code).toBe('GOOGLE_SIGNUP_REQUIRED');
  });

  it('returns the fresh CSRF token with a Google session', async () => {
    const authService = {
      exchangeGoogleCode: async () => ({
        onboardingRequired: false as const,
        user: {},
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        csrfToken: 'session-csrf-token',
        sessionId: 'session-id',
      }),
    } as unknown as AuthService;
    const googleApp = createApp({ authService });

    const response = await request(googleApp)
      .post('/api/auth/google/exchange')
      .send({ code: 'handoff-token-123456789012345678901234' });
    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

    expect(response.status).toBe(200);
    expect(response.body.data.csrfToken).toBe('session-csrf-token');
    expect(cookies.some((cookie) => cookie?.includes('cc_csrf='))).toBe(true);
  });

  it('exchanges Google password recovery only into an HttpOnly reset cookie', async () => {
    const authService = {
      exchangePasswordRecoveryGoogleCode: async () => ({
        verified: true as const,
        resetToken: 'one-time-reset-token',
      }),
    } as unknown as AuthService;
    const googleApp = createApp({ authService });

    const response = await request(googleApp)
      .post('/api/auth/google/password-recovery/exchange')
      .send({ code: 'recovery-handoff-token-123456789012345678901234' });
    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ verified: true });
    expect(cookies.some((cookie) => cookie?.includes('cc_password_reset='))).toBe(true);
    expect(cookies.some((cookie) => cookie?.includes('HttpOnly'))).toBe(true);
    expect(response.body.data.resetToken).toBeUndefined();
  });
});
