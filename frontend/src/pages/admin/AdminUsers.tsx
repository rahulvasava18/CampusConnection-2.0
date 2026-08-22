import { useEffect, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Search, ShieldAlert, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, SectionHeading, cn } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import { getAdminStats, getAdminUsers, type AdminReportFilter, type AdminUserSort, type AdminUserStatus, type AdminUsersQuery } from '../../features/admin/admin.api';

function statusTone(status: AdminUserStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'warning';
  if (status === 'BANNED') return 'danger';
  if (status === 'DELETED') return 'neutral';
  return 'brand';
}

function date(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
}

export function AdminUsers({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<AdminUserStatus | ''>('');
  const [sort, setSort] = useState<AdminUserSort>('createdAt');
  const [reports, setReports] = useState<AdminReportFilter>('any');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<25 | 50 | 100>(25);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  const query = useMemo<AdminUsersQuery>(() => ({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status ? { status } : {}),
    sort,
    reports,
    page,
    limit,
  }), [debouncedSearch, limit, page, reports, sort, status]);
  const users = useQuery({ queryKey: ['admin', 'users', query], queryFn: () => getAdminUsers(query) });
  const stats = useQuery({ queryKey: ['admin', 'stats', '30d'], queryFn: () => getAdminStats('30d') });

  return (
    <section className="space-y-6">
      <SectionHeading eyebrow="Administration / Users" title="Users" description="Search, investigate, and moderate CampusConnection accounts." action={<Button variant="secondary" onClick={() => void users.refetch()}><ShieldAlert className="h-4 w-4" />Refresh</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total users', stats.data?.overview.totalUsers ?? 0, 'text-brand-700'],
          ['Active', stats.data?.overview.activeUsers ?? 0, 'text-emerald-700'],
          ['Suspended', stats.data?.overview.suspendedUsers ?? 0, 'text-amber-700'],
          ['Banned', stats.data?.overview.bannedUsers ?? 0, 'text-red-700'],
          ['Open reports', stats.data?.overview.pendingReports ?? 0, 'text-slate-700'],
        ].map(([label, value, color]) => <Card key={String(label)} className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className={cn('mt-2 text-2xl font-bold', String(color))}>{String(value)}</p></Card>)}
      </div>
      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_120px]">
          <label className="relative block"><span className="sr-only">Search users</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username, email, or college" className="w-full rounded-xl border border-line bg-[var(--surface-secondary)] py-3 pl-10 pr-4 text-sm text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10" /></label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">Status<select value={status} onChange={(event) => { setStatus(event.target.value as AdminUserStatus | ''); setPage(1); }} className="rounded-xl border border-line bg-[var(--surface-secondary)] px-3 py-3 text-sm font-semibold normal-case tracking-normal text-ink"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="BANNED">Banned</option><option value="DELETED">Deleted</option><option value="RESTRICTED">Restricted</option></select></label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">Sort<select value={sort} onChange={(event) => setSort(event.target.value as AdminUserSort)} className="rounded-xl border border-line bg-[var(--surface-secondary)] px-3 py-3 text-sm font-semibold normal-case tracking-normal text-ink"><option value="createdAt">Newest</option><option value="lastActive">Last active</option><option value="activity">Most active</option><option value="reports">Most reported</option></select></label>
          <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-muted">Reports<select value={reports} onChange={(event) => setReports(event.target.value as AdminReportFilter)} className="rounded-xl border border-line bg-[var(--surface-secondary)] px-3 py-3 text-sm font-semibold normal-case tracking-normal text-ink"><option value="any">Any</option><option value="reported">Reported</option><option value="frequent">3+</option></select></label>
        </div>
      </Card>
      {users.isLoading ? <LoadingState label="Loading users" /> : null}
      {users.error ? <ErrorState message={apiErrorMessage(users.error, 'Unable to load users.')} onRetry={() => void users.refetch()} /> : null}
      {users.data && !users.data.users.length ? <EmptyState title="No users found" description="Try changing your search or filters." /> : null}
      {users.data && users.data.users.length ? <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left"><thead className="border-b border-line bg-[var(--surface-secondary)] text-xs uppercase tracking-wide text-muted"><tr><th className="px-5 py-4">User</th><th className="px-4 py-4">Email</th><th className="px-4 py-4">College</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Joined</th><th className="px-4 py-4">Last active</th><th className="px-4 py-4">Posts</th><th className="px-4 py-4">Reports</th><th className="px-4 py-4">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">{users.data.users.map((user) => <tr key={user.id} className="transition hover:bg-[var(--surface-secondary)]"><td className="px-5 py-4"><button type="button" onClick={() => onNavigate(`/admin/users/${user.id}`)} className="flex items-center gap-3 text-left"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-800"><UserRound className="h-4 w-4" /></span><span><span className="block font-bold text-ink">{user.displayName}</span><span className="block text-xs text-muted">@{user.username}</span></span></button></td><td className="px-4 py-4 text-sm text-muted">{user.email}</td><td className="px-4 py-4 text-sm text-muted">{user.college ?? '—'}</td><td className="px-4 py-4"><Badge tone={statusTone(user.accountState)}>{user.accountState.replaceAll('_', ' ')}</Badge></td><td className="px-4 py-4 text-sm text-muted">{date(user.createdAt)}</td><td className="px-4 py-4 text-sm text-muted">{date(user.lastActiveAt)}</td><td className="px-4 py-4 text-sm font-semibold text-ink">{user.postsCount}</td><td className="px-4 py-4 text-sm font-semibold text-ink">{user.reportsCount}</td><td className="px-4 py-4"><details className="relative"><summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-700"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-line bg-[var(--surface-elevated)] p-1 shadow-xl"><button type="button" onClick={() => onNavigate(`/admin/users/${user.id}`)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-[var(--surface-secondary)]"><Eye className="h-4 w-4" />View investigation</button></div></details></td></tr>)}</tbody></table></div>
        <div className="flex flex-col gap-3 border-t border-line px-5 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between"><span>{users.data.pagination.total} users · Page {users.data.pagination.page} of {Math.max(users.data.pagination.totalPages, 1)}</span><div className="flex items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value) as 25 | 50 | 100); setPage(1); }} className="rounded-lg border border-line bg-[var(--surface-secondary)] px-2 py-2 text-xs font-semibold text-ink"><option value="25">25 / page</option><option value="50">50 / page</option><option value="100">100 / page</option></select><Button size="sm" variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || users.isFetching}>Previous</Button><Button size="sm" variant="secondary" onClick={() => setPage((value) => value + 1)} disabled={page >= users.data.pagination.totalPages || users.isFetching}>Next</Button></div></div>
      </Card> : null}
    </section>
  );
}
