import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const app = createApp();

describe('team invitation preview boundary', () => {
  it('requires authentication before evaluating invitation preview access', async () => {
    const response = await request(app).get(
      '/api/v1/teams/507f1f77bcf86cd799439011/invitation-preview',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
