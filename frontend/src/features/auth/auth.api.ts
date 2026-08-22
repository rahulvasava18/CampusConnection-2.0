import type { ApiErrorBody, UserView } from '@campusconnection/shared';
import { frontendEnv } from '../../lib/env';
import { ApiRequestError } from '../../lib/api-state';
import { useAuthStore } from './auth.store';

interface ApiResponse<T> {
  data: T;
}

function isPaginatedResponse(value: unknown): value is { data: unknown; pagination: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value && 'pagination' in value;
}

export interface SessionResponse {
  user: UserView;
  accessToken: string;
  csrfToken: string;
  sessionId: string;
}

let refreshInFlight: Promise<SessionResponse> | undefined;
let csrfBootstrapInFlight: Promise<string> | undefined;

function csrfToken(): string | undefined {
  const sessionToken = useAuthStore.getState().csrfToken;
  if (sessionToken) return sessionToken;
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('cc_csrf='))
    ?.split('=')
    .slice(1)
    .join('=');
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = useAuthStore.getState().accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = options.method?.toUpperCase() ?? 'GET';
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrf = csrfToken();
    if (csrf) headers.set('X-CSRF-Token', decodeURIComponent(csrf));
  }
  const response = await fetch(`${frontendEnv.VITE_API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const publicAuthRequest = [
    '/auth/login',
    '/auth/signup',
    '/auth/google/exchange',
    '/auth/google/password-recovery/exchange',
    '/auth/google/onboarding',
    '/auth/google/onboarding/username-availability',
    '/auth/verify-email',
    '/auth/resend-verification',
  ].some((route) => path.startsWith(route));
  if (response.status === 401 && retry && !path.startsWith('/auth/refresh') && !publicAuthRequest) {
    try {
      await refreshSession();
      return apiRequest<T>(path, options, false);
    } catch {
      useAuthStore.getState().clearSession();
    }
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(response.status, body?.error);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as unknown;
  if (isPaginatedResponse(body)) return body as T;
  return (body as ApiResponse<T>).data;
}

export function signup(input: {
  displayName: string;
  username: string;
  email: string;
  password: string;
}): Promise<{ email: string; verificationRequired: boolean }> {
  return apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { identifier: string; password: string }): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => {
    useAuthStore.getState().setSession(result.accessToken, result.user, result.csrfToken);
    return result;
  });
}

export function continueWithGoogle(): void {
  window.location.assign(`${frontendEnv.VITE_API_BASE_URL}/auth/google`);
}

export interface GoogleOnboardingResponse {
  onboardingRequired: true;
  onboardingToken: string;
  displayName: string;
  email: string;
}

export type GoogleExchangeResponse = SessionResponse | GoogleOnboardingResponse;

export function exchangeGoogleCode(code: string): Promise<GoogleExchangeResponse> {
  return apiRequest<GoogleExchangeResponse>('/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }).then((result) => {
    if (!('onboardingRequired' in result))
      useAuthStore.getState().setSession(result.accessToken, result.user, result.csrfToken);
    return result;
  });
}

export function checkGoogleUsernameAvailability(input: {
  onboardingToken: string;
  username: string;
}): Promise<{ available: boolean }> {
  return apiRequest('/auth/google/onboarding/username-availability', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function completeGoogleOnboarding(input: {
  onboardingToken: string;
  displayName: string;
  username: string;
}): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/google/onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((result) => {
    useAuthStore.getState().setSession(result.accessToken, result.user, result.csrfToken);
    return result;
  });
}

export function verifyEmail(token: string): Promise<{ verified: boolean }> {
  return apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export function resendVerification(input: {
  identifier: string;
}): Promise<{ email: string; verificationRequired: boolean }> {
  return apiRequest('/auth/resend-verification', { method: 'POST', body: JSON.stringify(input) });
}

export function refreshSession(): Promise<SessionResponse> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = ensureCsrfToken()
    .then(() => apiRequest<SessionResponse>('/auth/refresh', { method: 'POST' }, false))
    .then((result) => {
      useAuthStore.getState().setSession(result.accessToken, result.user, result.csrfToken);
      return result;
    })
    .finally(() => {
      refreshInFlight = undefined;
    });
  return refreshInFlight;
}

function ensureCsrfToken(): Promise<string> {
  const current = useAuthStore.getState().csrfToken ?? csrfToken();
  if (current) {
    useAuthStore.getState().setCsrfToken(current);
    return Promise.resolve(current);
  }
  if (csrfBootstrapInFlight) return csrfBootstrapInFlight;
  csrfBootstrapInFlight = apiRequest<{ csrfToken: string }>('/auth/csrf', {}, false)
    .then((result) => {
      useAuthStore.getState().setCsrfToken(result.csrfToken);
      return result.csrfToken;
    })
    .finally(() => {
      csrfBootstrapInFlight = undefined;
    });
  return csrfBootstrapInFlight;
}

export async function getCurrentUser(): Promise<UserView> {
  const result = await apiRequest<{ user: UserView }>('/me');
  useAuthStore.getState().setUser(result.user);
  return result.user;
}

export interface ProfileUpdateInput {
  displayName?: string;
  bio?: string;
  college?: string;
  department?: string;
  course?: string;
  graduationYear?: number;
  skills?: string[];
  interests?: string[];
  goals?: string[];
  avatarUrl?: string;
}

export function updateProfile(input: ProfileUpdateInput): Promise<UserView> {
  return apiRequest<{ user: UserView }>('/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  }).then((result) => {
    useAuthStore.getState().setUser(result.user);
    return result.user;
  });
}

export async function logout(): Promise<void> {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST' });
  } finally {
    useAuthStore.getState().clearSession();
  }
}

export function deleteAccount(): Promise<void> {
  return apiRequest<void>('/auth/account', { method: 'DELETE' });
}
