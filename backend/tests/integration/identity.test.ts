import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const app = createApp();

describe('password identity API', () => {
  it('keeps the refresh endpoint behind CSRF validation', async () => {
    const response = await request(app).post('/api/v1/auth/refresh');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_ORIGIN_INVALID');
  });

  it('validates signup and login payloads at the public boundary', async () => {
    const signup = await request(app).post('/api/v1/auth/signup').send({});
    expect(signup.status).toBe(422);
    expect(signup.body.error.code).toBe('VALIDATION_ERROR');

    const login = await request(app).post('/api/v1/auth/login').send({});
    expect(login.status).toBe(422);
    expect(login.body.error.code).toBe('VALIDATION_ERROR');
  });
});
