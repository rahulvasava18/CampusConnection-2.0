import type { useAuthStore } from '../../features/auth/auth.store';
import { AdminDashboard } from './AdminDashboard';
import { AdminLayout } from './AdminLayout';
import { RestrictedState } from '../../components/ui';
import { AdminUsers } from './AdminUsers';
import { AdminUserDetail } from './AdminUserDetail';
import { AdminAnalytics } from './AdminAnalytics';
import { AdminReports } from './AdminReports';
import { AdminReportDetail } from './AdminReportDetail';
import { AdminContent } from './AdminContent';
import { AdminAuditLogs } from './AdminAuditLogs';
import { AdminNotifications } from './AdminNotifications';
import { AdminModeration } from './AdminModeration';
import { AdminSettings } from './AdminSettings';
import { AdminClubs } from './AdminClubs';

type AppUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;

export function AdminRoutes({ user, onNavigate, onSignOut }: { user: AppUser; onNavigate: (target: string) => void; onSignOut: () => void }) {
  if (!user.roles.includes('PLATFORM_ADMIN')) {
    return <RestrictedState title="Administrator access required" message="This area is restricted to platform administrators." />;
  }
  const pathname = window.location.pathname;
  const content = pathname === '/admin/users'
    ? <AdminUsers onNavigate={onNavigate} />
    : /^\/admin\/users\/[^/]+$/.test(pathname)
      ? <AdminUserDetail userId={pathname.split('/')[3] ?? ''} onNavigate={onNavigate} />
      : pathname === '/admin/analytics' ? <AdminAnalytics />
      : pathname === '/admin/reports' ? <AdminReports onNavigate={onNavigate} />
      : /^\/admin\/reports\/[^/]+$/.test(pathname) ? <AdminReportDetail reportId={pathname.split('/')[3] ?? ''} onNavigate={onNavigate} />
      : pathname === '/admin/posts' ? <AdminContent type="POST" onNavigate={onNavigate} />
      : pathname === '/admin/comments' ? <AdminContent type="COMMENT" onNavigate={onNavigate} />
      : pathname === '/admin/teams' ? <AdminContent type="TEAM" onNavigate={onNavigate} />
      : pathname === '/admin/communities' ? <AdminContent type="COMMUNITY" onNavigate={onNavigate} />
      : pathname === '/admin/clubs' ? <AdminClubs />
      : pathname === '/admin/events' ? <AdminContent type="EVENT" onNavigate={onNavigate} />
      : pathname === '/admin/audit-logs' ? <AdminAuditLogs />
      : pathname === '/admin/notifications' ? <AdminNotifications onNavigate={onNavigate} />
      : pathname === '/admin/moderation' ? <AdminModeration onNavigate={onNavigate} />
      : pathname === '/admin/settings' ? <AdminSettings />
      : <AdminDashboard />;
  return <AdminLayout user={user} onNavigate={onNavigate} onSignOut={onSignOut}>{content}</AdminLayout>;
}
