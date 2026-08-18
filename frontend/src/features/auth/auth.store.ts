import { create } from 'zustand';
import type { UserView } from '@campusconnection/shared';

interface AuthState {
  accessToken: string | null;
  csrfToken: string | null;
  user: UserView | null;
  googleOnboardingToken: string | null;
  status: 'unknown' | 'authenticated' | 'anonymous';
  setSession: (accessToken: string, user: UserView, csrfToken: string) => void;
  setCsrfToken: (csrfToken: string) => void;
  setUser: (user: UserView) => void;
  clearSession: () => void;
  setGoogleOnboardingToken: (token: string) => void;
  clearGoogleOnboardingToken: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  csrfToken: null,
  user: null,
  googleOnboardingToken: null,
  status: 'unknown',
  setSession: (accessToken, user, csrfToken) =>
    set({ accessToken, csrfToken, user, status: 'authenticated' }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  clearSession: () =>
    set({
      accessToken: null,
      csrfToken: null,
      user: null,
      googleOnboardingToken: null,
      status: 'anonymous',
    }),
  setGoogleOnboardingToken: (googleOnboardingToken) => set({ googleOnboardingToken }),
  clearGoogleOnboardingToken: () => set({ googleOnboardingToken: null }),
}));
