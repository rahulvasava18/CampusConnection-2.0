import { useState, type FormEvent } from 'react';
import { Bell, Menu, Network, Search, UserRound, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/app-store';
import type { useAuthStore } from '../features/auth/auth.store';
import { getUnreadNotificationCount } from '../features/notifications/notifications.api';
import { Avatar } from './ui';
import { primaryNav, workspaceNav } from '../lib/navigation';
import { useTheme } from '../theme/ThemeProvider';
import { CampusMoonIcon, CampusSettingsIcon, CampusSunIcon } from './icons/CampusIcons';

type AppUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
type Navigate = (target: string) => void;

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="gradient-campus-energy relative flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-[0_0_22px_rgba(119,166,247,.28)]">
        <Network className="h-5 w-5" />
        <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-yellow" />
      </span>
      <span>
        <span className="type-display block text-base font-bold tracking-tight text-slate-950">
          CampusConnection
        </span>
        <span className="type-ui block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00887a]">
          Stay connected
        </span>
      </span>
    </div>
  );
}

export function Navbar({ onNavigate, user }: { onNavigate: Navigate; user: AppUser }) {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState(useAppStore.getState().discoveryQuery);
  const setDiscoveryQuery = useAppStore((state) => state.setDiscoveryQuery);
  const toggleNavigation = useAppStore((state) => state.toggleNavigation);
  const unreadNotifications = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    enabled: ['ACTIVE', 'RESTRICTED'].includes(user.accountState),
    refetchInterval: 30000,
  });
  const unreadCount = unreadNotifications.data?.unreadCount ?? 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    setDiscoveryQuery(query);
    onNavigate('search');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-brand-200 bg-white/95 backdrop-blur-xl">
      <div className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={toggleNavigation}
          className="min-h-11 min-w-11 rounded-xl p-2 text-slate-500 hover:bg-brand-50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
        <form onSubmit={submit} className="relative ml-auto flex max-w-2xl flex-1 lg:mx-auto">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-500" />
          <input
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, teams, projects..."
            className="type-ui w-full rounded-xl border border-line bg-slate-100 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-brand-500 focus:bg-slate-50 focus:ring-4 focus:ring-brand-500/20"
          />
        </form>
        <button
          type="button"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          title="Notifications"
          onClick={() => onNavigate('notifications')}
          className="relative hidden min-h-11 min-w-11 rounded-xl p-2.5 text-slate-500 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 sm:block"
        >
          <Bell className="h-5 w-5" />
          {unreadCount ? (
            <span className="absolute right-0.5 top-0.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="min-h-11 min-w-11 rounded-xl p-2.5 text-slate-500 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {theme === 'dark' ? (
            <CampusSunIcon className="h-5 w-5" />
          ) : (
            <CampusMoonIcon className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => onNavigate('settings')}
          className="hidden min-h-11 min-w-11 rounded-xl p-2.5 text-slate-500 hover:bg-brand-50 sm:block"
        >
          <CampusSettingsIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('profile')}
          className="hidden min-h-11 items-center gap-2 rounded-xl p-1.5 text-left hover:bg-brand-50 sm:flex"
        >
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
          <span className="hidden max-w-28 truncate text-sm font-semibold text-slate-900 xl:block">
            {user.displayName}
          </span>
        </button>
      </div>
    </header>
  );
}

export function MobileNavigation({ onNavigate }: { onNavigate: Navigate }) {
  const isNavigationOpen = useAppStore((state) => state.isNavigationOpen);
  const toggleNavigation = useAppStore((state) => state.toggleNavigation);
  if (!isNavigationOpen) return null;
  const items = [
    ...primaryNav,
    ...workspaceNav,
    { id: 'profile' as const, label: 'Profile', icon: UserRound },
    { id: 'settings' as const, label: 'Settings', icon: CampusSettingsIcon },
  ];
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Navigation menu">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={toggleNavigation}
        className="absolute inset-0 bg-slate-950/30"
      />
      <div className="relative h-full w-[min(21rem,88vw)] bg-white px-5 py-6 shadow-[0_12px_40px_rgba(43,87,145,.18)]">
        <div className="flex items-center justify-between">
          <Brand />
          <button
            type="button"
            aria-label="Close navigation"
            onClick={toggleNavigation}
            className="rounded-lg p-2 text-slate-500 hover:bg-brand-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-8 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700"
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
