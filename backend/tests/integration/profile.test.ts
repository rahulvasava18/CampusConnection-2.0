import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('profile API', () => {
  it('requires authentication before profile data can be read', async () => {
    const response = await request(createApp()).get(
      '/api/users/507f1f77bcf86cd799439011/profile',
    );
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });
});
