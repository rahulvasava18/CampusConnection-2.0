import { getEnv } from '../../../config/env';
import { AppError } from '../../../shared/errors/app-error';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  displayName: string;
}

export interface GoogleOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImplementation?: typeof fetch;
}

interface GoogleTokenResponse {
  id_token?: unknown;
}

interface GoogleTokenInfo {
  aud?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  nonce?: unknown;
}

export class GoogleOAuthClient {
  private readonly fetchImplementation: typeof fetch;

  public constructor(private readonly options: GoogleOAuthClientOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  public authorizationUrl(state: string, nonce: string): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
      nonce,
    }).toString();
    return url.toString();
  }

  public async authenticate(code: string, expectedNonce: string): Promise<GoogleIdentity> {
    const tokenResponse = await this.fetchImplementation('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        redirect_uri: this.options.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new AppError('GOOGLE_AUTH_FAILED', 'Google authentication failed.', 401);
    const tokenBody = (await tokenResponse.json().catch(() => null)) as GoogleTokenResponse | null;
    const idToken = typeof tokenBody?.id_token === 'string' ? tokenBody.id_token : undefined;
    if (!idToken) throw new AppError('GOOGLE_AUTH_FAILED', 'Google authentication failed.', 401);

    const infoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
    infoUrl.searchParams.set('id_token', idToken);
    const infoResponse = await this.fetchImplementation(infoUrl, { method: 'GET' });
    if (!infoResponse.ok) throw new AppError('GOOGLE_AUTH_FAILED', 'Google authentication failed.', 401);
    const info = (await infoResponse.json().catch(() => null)) as GoogleTokenInfo | null;
    if (
      typeof info?.aud !== 'string' ||
      info.aud !== this.options.clientId ||
      typeof info.sub !== 'string' ||
      typeof info.email !== 'string' ||
      info.email_verified !== 'true' ||
      info.nonce !== expectedNonce
    ) {
      throw new AppError('GOOGLE_AUTH_FAILED', 'Google authentication failed.', 401);
    }
    return {
      googleId: info.sub,
      email: info.email.trim().toLowerCase(),
      displayName:
        typeof info.name === 'string' && info.name.trim()
          ? info.name.trim()
          : info.email.split('@')[0] ?? 'Campus student',
    };
  }
}

export function createGoogleOAuthClient(): GoogleOAuthClient {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
    throw new AppError('GOOGLE_AUTH_NOT_CONFIGURED', 'Google Sign-In is not configured.', 503);
  return new GoogleOAuthClient({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  });
}
