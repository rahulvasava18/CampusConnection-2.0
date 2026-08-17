import { create } from 'zustand';
import type { UserView } from '@campusconnection/shared';

interface AuthState {
  accessToken: string | null;
  user: UserView | null;
  status: 'unknown' | 'authenticated' | 'anonymous';
  setSession: (accessToken: string, user: UserView) => void;
  setUser: (user: UserView) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  setUser: (user) => set({ user, status: 'authenticated' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'anonymous' }),
}));
