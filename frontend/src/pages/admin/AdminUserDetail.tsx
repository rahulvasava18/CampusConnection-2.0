import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Activity, Ban, CheckCircle2, Clock3, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, SectionHeading, cn } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import {
  banAdminUser,
  deleteAdminUser,
  getAdminUser,
  getAdminUserActivity,
  getAdminUserContent,
  getAdminUserModerationHistory,
  getAdminUserReports,
  restoreAdminUser,
  suspendAdminUser,
  warnAdminUser,
  type AdminUserStatus,
  type SuspensionDuration,
} from '../../features/admin/admin.api';
import { AdminDangerDialog } from './AdminDangerDialog';

type DialogKind = 'warning' | 'suspend' | 'ban' | 'delete' | null;
type Tab = 'overview' | 'activity' | 'content' | 'reports' | 'moderation';

function tone(status: AdminUserStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'warning';
  if (status === 'BANNED') return 'danger';
  if (status === 'DELETED') return 'neutral';
  return 'brand';
}

function format(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function AdminUserDetail({ userId, onNavigate }: { userId: string; onNavigate: (target: string) => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [suspensionDuration, setSuspensionDuration] = useState<SuspensionDuration>('7d');
  const user = useQuery({ queryKey: ['admin', 'user', userId], queryFn: () => getAdminUser(userId) });
  const activity = useQuery({ queryKey: ['admin', 'user', userId, 'activity'], queryFn: () => getAdminUserActivity(userId), enabled: tab === 'activity' });
  const content = useQuery({ queryKey: ['admin', 'user', userId, 'content'], queryFn: () => getAdminUserContent(userId), enabled: tab === 'content' });
  const reports = useQuery({ queryKey: ['admin', 'user', userId, 'reports'], queryFn: () => getAdminUserReports(userId), enabled: tab === 'reports' });
  const history = useQuery({ queryKey: ['admin', 'user', userId, 'moderation'], queryFn: () => getAdminUserModerationHistory(userId), enabled: tab === 'moderation' });
  const mutation = useMutation({
    mutationFn: async (input: { kind: Exclude<DialogKind, null>; reason: string; confirmation: string }) => {
      if (input.kind === 'warning') return warnAdminUser(userId, { reason: input.reason, notifyUser: true });
      if (input.kind === 'suspend') return suspendAdminUser(userId, { duration: suspensionDuration, reason: input.reason, notifyUser: true });
      if (input.kind === 'ban') return banAdminUser(userId, { reason: input.reason, confirmation: 'BAN', notifyUser: true });
      return deleteAdminUser(userId, { reason: input.reason, confirmation: 'DELETE' });
    },
    onSuccess: () => {
      setDialog(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
  const closeDialog = useCallback(() => {
    if (!mutation.isPending) setDialog(null);
  }, [mutation.isPending]);
  const restore = useMutation({
    mutationFn: () => restoreAdminUser(userId, { notifyUser: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
  const dialogCopy = useMemo(() => ({
    warning: { title: 'Issue warning', description: 'Create a moderation record and notify this user about the platform warning.', confirm: 'Issue warning', tone: 'warning' as const },
    suspend: { title: 'Suspend user', description: 'This will block the account from authenticated access for seven days.', confirm: 'Suspend user', tone: 'warning' as const },
    ban: { title: 'Ban user', description: 'This will revoke active sessions and prevent the account from accessing CampusConnection.', confirm: 'Ban user', tone: 'danger' as const },
    delete: { title: 'Delete user', description: 'This soft-deletes the account and revokes its active sessions. Historical moderation records are retained.', confirm: 'Delete user', tone: 'danger' as const },
  } as const), []);

  if (user.isLoading) return <LoadingState label="Loading user investigation" />;
  if (user.error) return <ErrorState message={apiErrorMessage(user.error, 'Unable to load this user.')} onRetry={() => void user.refetch()} />;
  if (!user.data) return <EmptyState title="User not found" description="This account may have been removed or the identifier is invalid." />;
  const current = user.data;
  const status = current.user.accountState;
  const canSuspend = ['ACTIVE', 'RESTRICTED'].includes(status);
  const canBan = !['BANNED', 'DELETED'].includes(status);
  const canRestore = ['SUSPENDED', 'BANNED'].includes(status);

  return (
    <section className="space-y-6">
      <button type="button" onClick={() => onNavigate('/admin/users')} className="text-sm font-semibold text-brand-700 hover:text-brand-900">← Back to users</button>
      <Card className="p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-4"><span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800"><UserRound className="h-7 w-7" /></span><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-ink">{current.user.displayName}</h1><Badge tone={tone(status)}>{status.replaceAll('_', ' ')}</Badge></div><p className="mt-1 text-sm text-muted">@{current.user.username} · {current.user.email}</p><p className="mt-2 text-sm text-muted">{current.user.college ?? 'College not provided'}{current.user.course ? ` · ${current.user.course}` : ''}</p></div></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => setDialog('warning')} disabled={status === 'DELETED'}><ShieldAlert className="h-4 w-4" />Warn</Button>{canSuspend ? <Button size="sm" variant="secondary" onClick={() => setDialog('suspend')}><Clock3 className="h-4 w-4" />Suspend</Button> : null}{canRestore ? <Button size="sm" variant="success" onClick={() => restore.mutate()} disabled={restore.isPending}><CheckCircle2 className="h-4 w-4" />{restore.isPending ? 'Restoring…' : 'Restore'}</Button> : null}{canBan ? <Button size="sm" variant="danger" onClick={() => setDialog('ban')}><Ban className="h-4 w-4" />Ban</Button> : null}{status !== 'DELETED' ? <Button size="sm" variant="danger" onClick={() => setDialog('delete')}><Trash2 className="h-4 w-4" />Delete</Button> : null}</div></div>
        {restore.error ? <p className="mt-4 text-sm text-red-700">{apiErrorMessage(restore.error, 'Unable to restore this account.')}</p> : null}
      </Card>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">{[['Posts', current.activity.posts], ['Comments', current.activity.comments], ['Teams', current.activity.teams], ['Communities', current.activity.communities], ['Reports', current.reports.aboutUser], ['Warnings', current.moderation.warnings]].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-2 text-2xl font-bold text-ink">{String(value)}</p></Card>)}</div>
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-[var(--surface-elevated)] p-1">{([['overview', 'Overview'], ['activity', 'Activity'], ['content', 'Content'], ['reports', 'Reports'], ['moderation', 'Moderation history']] as Array<[Tab, string]>).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={cn('whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === id ? 'bg-brand-600 text-white' : 'text-muted hover:bg-[var(--surface-secondary)] hover:text-ink')}>{label}</button>)}</div>
      {tab === 'overview' ? <div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><SectionHeading eyebrow="Identity" title="Account details" /> <dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Display name', current.user.displayName], ['Username', `@${current.user.username}`], ['Email', current.user.email], ['College', current.user.college ?? 'Not provided'], ['Joined', format(current.account.joinedAt)], ['Last active', current.account.lastActiveAt ? format(current.account.lastActiveAt) : 'Never']].map(([label, value]) => <div key={String(label)}><dt className="text-xs font-bold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{String(value)}</dd></div>)}</dl></Card><Card className="p-5"><SectionHeading eyebrow="Moderation" title="Account posture" /><div className="mt-5 space-y-3 text-sm"><p className="flex justify-between gap-4"><span className="text-muted">Open reports</span><strong className="text-ink">{current.reports.open}</strong></p><p className="flex justify-between gap-4"><span className="text-muted">Resolved reports</span><strong className="text-ink">{current.reports.resolved}</strong></p><p className="flex justify-between gap-4"><span className="text-muted">Suspensions</span><strong className="text-ink">{current.moderation.suspensions}</strong></p><p className="flex justify-between gap-4"><span className="text-muted">Bans</span><strong className="text-ink">{current.moderation.bans}</strong></p>{current.account.suspension ? <p className="rounded-xl bg-amber-50 px-3 py-3 text-amber-900">Suspended until {format(current.account.suspension.until)}{current.account.suspension.reason ? ` · ${current.account.suspension.reason}` : ''}</p> : null}{current.account.banReason ? <p className="rounded-xl bg-red-50 px-3 py-3 text-red-900">Ban reason: {current.account.banReason}</p> : null}</div></Card></div> : null}
      {tab === 'activity' ? <DataSection loading={activity.isLoading} error={activity.error} empty={!activity.data?.length} emptyTitle="No activity" emptyDescription="This user has no recorded creation activity." retry={() => void activity.refetch()}>{activity.data?.map((item) => <div key={item.id} className="flex gap-3 border-b border-line py-4 last:border-0"><span className="mt-1 rounded-full bg-brand-100 p-2 text-brand-700"><Activity className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-ink">{item.message}</p><p className="mt-1 text-xs text-muted">{format(item.createdAt)}</p></div></div>)}</DataSection> : null}
      {tab === 'content' ? <DataSection loading={content.isLoading} error={content.error} empty={!content.data?.length} emptyTitle="No content" emptyDescription="This user has not created any content yet." retry={() => void content.refetch()}>{content.data?.map((item) => <div key={`${item.type}-${item.id}`} className="flex flex-col gap-3 border-b border-line py-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><Badge tone="brand">{item.type}</Badge><span className="text-xs text-muted">{format(item.createdAt)}</span></div><p className="mt-2 text-sm text-ink">{item.preview}</p></div><div className="flex shrink-0 gap-3 text-xs text-muted"><span>{item.engagement} engagement</span><span>{item.reportCount} reports</span><Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>{item.status}</Badge></div></div>)}</DataSection> : null}
      {tab === 'reports' ? <DataSection loading={reports.isLoading} error={reports.error} empty={!reports.data?.length} emptyTitle="No reports" emptyDescription="No reports are associated with this user." retry={() => void reports.refetch()}>{reports.data?.map((item) => <div key={`${item.direction}-${item.id}`} className="border-b border-line py-4 last:border-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={item.direction === 'ABOUT_USER' ? 'danger' : 'neutral'}>{item.direction === 'ABOUT_USER' ? 'About user' : 'Created by user'}</Badge><Badge tone={item.status === 'OPEN' ? 'warning' : 'success'}>{item.status}</Badge><span className="text-xs text-muted">{format(item.createdAt)}</span></div><p className="mt-2 text-sm font-semibold text-ink">{item.reason}</p><p className="mt-1 text-xs text-muted">{item.targetType} · {item.targetId}{item.resolution ? ` · ${item.resolution}` : ''}</p></div>)}</DataSection> : null}
      {tab === 'moderation' ? <DataSection loading={history.isLoading} error={history.error} empty={!history.data?.length} emptyTitle="No moderation history" emptyDescription="No warnings or account actions have been recorded." retry={() => void history.refetch()}>{history.data?.map((item) => <div key={item.id} className="flex gap-3 border-b border-line py-4 last:border-0"><span className={cn('mt-1 rounded-full p-2', item.action === 'BAN' || item.action === 'SOFT_DELETE' ? 'bg-red-100 text-red-700' : item.action === 'WARNING' || item.action === 'SUSPENSION' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}><ShieldAlert className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><Badge tone={item.action === 'BAN' || item.action === 'SOFT_DELETE' ? 'danger' : item.action === 'RESTORE' ? 'success' : 'warning'}>{item.action.replace('_', ' ')}</Badge><span className="text-xs text-muted">{format(item.createdAt)}</span></div><p className="mt-2 text-sm text-ink">{item.reason}</p><p className="mt-1 text-xs text-muted">Admin {item.adminId}{item.expiresAt ? ` · expires ${format(item.expiresAt)}` : ''}</p></div></div>)}</DataSection> : null}
      {dialog ? <AdminDangerDialog open title={dialogCopy[dialog].title} description={dialogCopy[dialog].description} target={`@${current.user.username}`} confirmLabel={dialogCopy[dialog].confirm} tone={dialogCopy[dialog].tone} duration={dialog === 'suspend'} durationValue={suspensionDuration} onDurationChange={setSuspensionDuration} {...(dialog === 'ban' ? { confirmationLabel: 'BAN' } : dialog === 'delete' ? { confirmationLabel: 'DELETE' } : {})} loading={mutation.isPending} {...(mutation.error ? { error: apiErrorMessage(mutation.error, 'Unable to complete moderation action.') } : {})} onClose={closeDialog} onConfirm={(reason, confirmation) => mutation.mutate({ kind: dialog, reason, confirmation })} /> : null}
    </section>
  );
}

function DataSection({ loading, error, empty, emptyTitle, emptyDescription, retry, children }: { loading: boolean; error: unknown; empty: boolean; emptyTitle: string; emptyDescription: string; retry: () => void; children: ReactNode }) {
  if (loading) return <LoadingState label="Loading section" />;
  if (error) return <ErrorState message={apiErrorMessage(error, 'Unable to load this section.')} onRetry={retry} />;
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <Card className="p-5">{children}</Card>;
}
