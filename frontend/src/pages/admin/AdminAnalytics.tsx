import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, LineChart, PieChart } from '@mui/x-charts';
import { RefreshCcw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, SectionHeading } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import { getAdminAnalytics, type AdminStatsRange } from '../../features/admin/admin.api';

const ranges: Array<{ value: AdminStatsRange; label: string }> = [
  { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' }, { value: '6m', label: '6 months' }, { value: '1y', label: '1 year' },
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="min-w-0 p-5 sm:p-6"><h2 className="font-bold text-ink">{title}</h2><div className="mt-4 min-w-0 overflow-hidden">{children}</div></Card>;
}

export function AdminAnalytics() {
  const [range, setRange] = useState<AdminStatsRange>('30d');
  const analytics = useQuery({ queryKey: ['admin-analytics', range], queryFn: () => getAdminAnalytics(range) });
  const dates = useMemo(() => analytics.data?.activity.map((item) => String(item.date)) ?? [], [analytics.data]);
  const number = (value: number | undefined) => new Intl.NumberFormat().format(value ?? 0);
  return <section className="space-y-6">
    <SectionHeading eyebrow="Insights" title="Platform analytics" description="Server-generated activity, growth, engagement, and safety metrics." action={<div className="flex gap-2"><select aria-label="Analytics range" value={range} onChange={(event) => setRange(event.target.value as AdminStatsRange)} className="rounded-xl border border-line bg-[var(--surface-primary)] px-3 py-2 text-sm text-ink">{ranges.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button variant="secondary" onClick={() => void analytics.refetch()}><RefreshCcw className="h-4 w-4" />Refresh</Button></div>} />
    {analytics.isLoading ? <Card className="p-8 text-sm text-muted">Loading analytics…</Card> : null}
    {analytics.error ? <ErrorState message={apiErrorMessage(analytics.error, 'Analytics are unavailable.')} onRetry={() => void analytics.refetch()} /> : null}
    {analytics.data ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[['Users', analytics.data.overview.totalUsers], ['Active users', analytics.data.overview.activeUsers], ['Posts', analytics.data.overview.totalPosts], ['Communities', analytics.data.overview.totalCommunities], ['Pending reports', analytics.data.overview.pendingReports]].map(([label, value]) => <Card key={String(label)} className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-2 text-3xl font-black text-ink">{number(value as number)}</p></Card>)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><ChartCard title="Daily activity"><LineChart height={320} margin={{ left: 48, right: 16, top: 16, bottom: 44 }} xAxis={[{ scaleType: 'point', data: dates }]} series={[{ data: analytics.data.activity.map((item) => Number(item.users ?? 0)), label: 'New users', color: '#77a6f7' }, { data: analytics.data.activity.map((item) => Number(item.activeUsers ?? 0)), label: 'Active users', color: '#00887a' }]} /></ChartCard><ChartCard title="Account states">{analytics.data.accountStates.length ? <PieChart height={320} series={[{ data: analytics.data.accountStates.map((item, index) => ({ id: index, label: item.label, value: item.value })), innerRadius: 60, paddingAngle: 3 }]} /> : <EmptyState title="No account data" description="Account states will appear when users exist." />}</ChartCard></div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]"><ChartCard title="Content and participation"><BarChart height={320} margin={{ left: 48, right: 16, top: 16, bottom: 44 }} xAxis={[{ scaleType: 'band', data: dates }]} series={[{ data: analytics.data.activity.map((item) => Number(item.posts ?? 0)), label: 'Posts', color: '#77a6f7' }, { data: analytics.data.activity.map((item) => Number(item.comments ?? 0)), label: 'Comments', color: '#00887a' }, { data: analytics.data.activity.map((item) => Number(item.registrations ?? 0)), label: 'Registrations', color: '#ff9c66' }]} /></ChartCard><ChartCard title="Reports by target">{analytics.data.reportTargets.length ? <BarChart height={320} xAxis={[{ scaleType: 'band', data: analytics.data.reportTargets.map((item) => item.label) }]} series={[{ data: analytics.data.reportTargets.map((item) => item.value), label: 'Reports', color: '#ed3f27' }]} /> : <EmptyState title="No reports" description="Report distribution will appear when reports are submitted." />}</ChartCard></div>
      <div className="flex flex-wrap gap-2">{Object.entries(analytics.data.platformHealth).map(([key, value]) => <Badge key={key} tone={key === 'moderationBacklog' && value > 0 ? 'warning' : 'neutral'}>{key.replace(/([A-Z])/g, ' $1')}: {number(value)}</Badge>)}</div>
    </> : null}
  </section>;
}
