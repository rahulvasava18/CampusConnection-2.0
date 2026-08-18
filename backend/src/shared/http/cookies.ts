import { getEnv } from '../../config/env';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
  path?: string;
  maxAge?: number;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('=' as string, 2))
      .filter((parts): parts is [string, string] => Boolean(parts[0] && parts[1]))
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.path) parts.push(`Path=${options.path}`);
  return parts.join('; ');
}

export function setAuthCookies(
  res: { append(name: string, value: string): void },
  refreshToken: string,
  csrfToken: string,
): void {
  const env = getEnv();
  const sameSite =
    env.COOKIE_SAME_SITE === 'strict' ? 'Strict' : env.COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax';
  const maxAge = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  res.append(
    'Set-Cookie',
    serializeCookie(env.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite,
      path: '/',
      maxAge,
    }),
  );
  setCsrfCookie(res, csrfToken);
}

export function setCsrfCookie(
  res: { append(name: string, value: string): void },
  csrfToken: string,
): void {
  const env = getEnv();
  const sameSite =
    env.COOKIE_SAME_SITE === 'strict' ? 'Strict' : env.COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax';
  const maxAge = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;
  res.append(
    'Set-Cookie',
    serializeCookie(env.CSRF_COOKIE_NAME, csrfToken, {
      secure: env.COOKIE_SECURE,
      sameSite,
      path: '/',
      maxAge,
    }),
  );
}

export function clearAuthCookies(res: { append(name: string, value: string): void }): void {
  const env = getEnv();
  const sameSite =
    env.COOKIE_SAME_SITE === 'strict' ? 'Strict' : env.COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax';
  for (const name of [env.refreshCookieName, env.CSRF_COOKIE_NAME])
    res.append(
      'Set-Cookie',
      serializeCookie(name, '', {
        httpOnly: name === env.refreshCookieName,
        secure: env.COOKIE_SECURE,
        sameSite,
        path: '/',
        maxAge: 0,
      }),
    );
}
