import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { UserView } from '@campusconnection/shared';
import { Avatar, cn } from '../../components/ui';
import { getAdminNotifications } from '../../features/admin/admin.api';

const navigationGroups = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: LayoutDashboard, path: '/admin' }, { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' }] },
  { label: 'Management', items: [{ label: 'Users', icon: Users, path: '/admin/users' }, { label: 'Posts', icon: FileText, path: '/admin/posts' }, { label: 'Comments', icon: FileText, path: '/admin/comments' }, { label: 'Teams', icon: Users, path: '/admin/teams' }, { label: 'Communities', icon: Users, path: '/admin/communities' }, { label: 'Clubs', icon: Users, path: '/admin/clubs' }, { label: 'Events', icon: Activity, path: '/admin/events' }] },
  { label: 'Safety', items: [{ label: 'Reports', icon: ShieldAlert, path: '/admin/reports' }, { label: 'Moderation', icon: ShieldAlert, path: '/admin/moderation' }] },
  { label: 'System', items: [{ label: 'Notifications', icon: Bell, path: '/admin/notifications' }, { label: 'Audit logs', icon: Activity, path: '/admin/audit-logs' }, { label: 'Settings', icon: BarChart3, path: '/admin/settings' }] },
];

export function AdminLayout({
  user,
  children,
  onSignOut,
  onNavigate,
}: {
  user: UserView;
  children: ReactNode;
  onSignOut: () => void;
  onNavigate: (target: string) => void;
}) {
  const notifications = useQuery({ queryKey: ['admin-notification-count'], queryFn: () => getAdminNotifications({ unread: true, limit: 1 }) });
  const currentPath = window.location.pathname;
  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-ink lg:flex">
      <aside className="hidden w-72 shrink-0 border-r border-line bg-[var(--surface-primary)] lg:flex lg:flex-col">
        <div className="border-b border-line px-7 py-6">
          <p className="type-ui text-xs font-black uppercase tracking-[0.22em] text-brand-600">
            CampusConnection
          </p>
          <h1 className="mt-2 type-display text-2xl font-bold tracking-tight text-ink">Admin control</h1>
          <p className="mt-1 text-sm text-muted">Monitor, manage, and protect the campus.</p>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6" aria-label="Admin navigation">
          {navigationGroups.map((group) => <div key={group.label} className="mb-5"><p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{group.label}</p>{group.items.map(({ label, icon: Icon, path }) => <button key={label} type="button" onClick={() => onNavigate(path)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted transition hover:bg-brand-50 hover:text-brand-800', currentPath === path || (path !== '/admin' && currentPath.startsWith(`${path}/`)) ? 'bg-brand-50 text-brand-800' : undefined)}><Icon className="h-4 w-4" />{label}{label === 'Notifications' && notifications.data?.unreadCount ? <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{notifications.data.unreadCount}</span> : null}</button>)}</div>)}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-secondary)] p-3">
            <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{user.displayName}</p>
              <p className="text-xs text-muted">Platform admin</p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={onSignOut}
              className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-20 items-center gap-4 border-b border-line bg-[var(--surface-primary)]/95 px-4 backdrop-blur sm:px-8">
          <button type="button" className="rounded-xl p-2 text-muted hover:bg-brand-50 lg:hidden" aria-label="Open admin navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative hidden max-w-xl flex-1 md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              aria-label="Search admin records"
              placeholder="Search CampusConnection..."
              className="w-full rounded-xl border border-line bg-[var(--surface-secondary)] py-3 pl-10 pr-4 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => onNavigate('/admin/notifications')} className="relative rounded-xl p-2.5 text-muted hover:bg-brand-50 hover:text-brand-700" aria-label="Admin notifications">
              <Bell className="h-5 w-5" />
              {notifications.data?.unreadCount ? <span className="absolute right-0 top-0 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{notifications.data.unreadCount}</span> : null}
            </button>
            <div className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
              <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
              <span className="text-sm font-bold text-ink">Admin</span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
