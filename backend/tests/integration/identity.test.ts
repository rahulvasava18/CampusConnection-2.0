import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

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
});
