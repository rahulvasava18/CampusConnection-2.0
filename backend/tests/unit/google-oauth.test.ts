import { describe, expect, it } from 'vitest';
import { GoogleOAuthClient } from '../../src/modules/identity/infrastructure/google-oauth.service';

function clientWithGoogleResponses(info: Record<string, unknown>) {
  return new GoogleOAuthClient({
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'http://localhost:4000/api/auth/google/callback',
    fetchImplementation: async (input) => {
      if (String(input).includes('/tokeninfo'))
        return new Response(JSON.stringify(info), { status: 200 });
      return new Response(JSON.stringify({ id_token: 'verified-id-token' }), { status: 200 });
    },
  });
}

describe('Google OAuth identity verification', () => {
  it('exchanges a code and accepts only a verified Google identity', async () => {
    const client = clientWithGoogleResponses({
      aud: 'google-client-id',
      sub: 'google-subject',
      email: 'Student@Example.com',
      email_verified: 'true',
      name: 'Campus Student',
      nonce: 'expected-nonce',
    });

    await expect(client.authenticate('authorization-code', 'expected-nonce')).resolves.toEqual({
      googleId: 'google-subject',
      email: 'student@example.com',
      displayName: 'Campus Student',
    });
  });

  it('rejects an unverified or mismatched Google identity', async () => {
    const client = clientWithGoogleResponses({
      aud: 'another-client-id',
      sub: 'google-subject',
      email: 'student@example.com',
      email_verified: 'false',
      nonce: 'wrong-nonce',
    });

    await expect(client.authenticate('authorization-code', 'expected-nonce')).rejects.toMatchObject({
      code: 'GOOGLE_AUTH_FAILED',
      statusCode: 401,
    });
  });

  it('rejects malformed provider responses without exposing provider data', async () => {
    const client = new GoogleOAuthClient({
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      redirectUri: 'http://localhost:4000/api/auth/google/callback',
      fetchImplementation: async () => new Response('not-json', { status: 200 }),
    });

    await expect(client.authenticate('authorization-code', 'expected-nonce')).rejects.toMatchObject({
      code: 'GOOGLE_AUTH_FAILED',
    });
  });
});
