import type { ReactNode } from 'react';
import type { useAuthStore } from '../features/auth/auth.store';
import { Navbar, MobileNavigation } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';

type AppUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;

export function AppLayout({
  user,
  onNavigate,
  children,
}: {
  user: AppUser;
  onNavigate: (target: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="page-enter surface-page min-h-screen">
      <Navbar onNavigate={onNavigate} user={user} />
      <MobileNavigation onNavigate={onNavigate} />
      <div className="flex w-full">
        <Sidebar onNavigate={onNavigate} />
        <main className="min-w-0 flex-1 px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:pb-12">{children}</main>
      </div>
    </div>
  );
}
