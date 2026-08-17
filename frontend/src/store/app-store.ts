import { create } from 'zustand';

interface AppState {
  isNavigationOpen: boolean;
  activeSection: string;
  discoveryQuery: string;
  toggleNavigation: () => void;
  setActiveSection: (section: string) => void;
  setDiscoveryQuery: (query: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isNavigationOpen: false,
  activeSection: 'home',
  discoveryQuery: '',
  toggleNavigation: () => set((state) => ({ isNavigationOpen: !state.isNavigationOpen })),
  setActiveSection: (activeSection) => set({ activeSection }),
  setDiscoveryQuery: (discoveryQuery) => set({ discoveryQuery }),
}));
