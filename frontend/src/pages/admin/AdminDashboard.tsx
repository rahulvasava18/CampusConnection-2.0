import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, LineChart, PieChart } from '@mui/x-charts';
import { AlertTriangle, ArrowUpRight, Database, RefreshCcw, ShieldCheck, Users } from 'lucide-react';
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeading } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-state';
import { getAdminStats, type AdminStatsRange } from '../../features/admin/admin.api';

const rangeOptions: Array<{ value: AdminStatsRange; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];

const statCards = [
  { key: 'totalUsers', label: 'Total users', icon: Users, tone: 'brand' },
  { key: 'activeUsers', label: 'Active users', icon: ShieldCheck, tone: 'success' },
  { key: 'newUsers', label: 'New users', icon: ArrowUpRight, tone: 'brand' },
  { key: 'totalPosts', label: 'Active posts', icon: Database, tone: 'brand' },
  { key: 'totalComments', label: 'Comments', icon: Database, tone: 'neutral' },
  { key: 'pendingReports', label: 'Pending reports', icon: AlertTriangle, tone: 'warning' },
  { key: 'suspendedUsers', label: 'Suspended users', icon: AlertTriangle, tone: 'warning' },
  { key: 'bannedUsers', label: 'Banned users', icon: AlertTriangle, tone: 'danger' },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <div>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      <div className="mt-5 min-w-0 overflow-hidden">{children}</div>
    </Card>
  );
}

export function AdminDashboard() {
  const [range, setRange] = useState<AdminStatsRange>('30d');
  const stats = useQuery({ queryKey: ['admin', 'stats', range], queryFn: () => getAdminStats(range) });
  const dateLabels = useMemo(() => stats.data?.userGrowth.map((point) => point.date) ?? [], [stats.data]);

  return (
    <section className="space-y-6">
      <SectionHeading
        eyebrow="Platform operations"
        title="Good morning, admin."
        description="A live operating view of CampusConnection activity, growth, and safety signals."
        action={
          <div className="flex items-center gap-2">
            <select
              aria-label="Analytics date range"
              value={range}
              onChange={(event) => setRange(event.target.value as AdminStatsRange)}
              className="rounded-xl border border-line bg-[var(--surface-primary)] px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-400"
            >
              {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" aria-label="Refresh admin statistics" onClick={() => void stats.refetch()} className="rounded-xl border border-line p-3 text-muted transition hover:bg-brand-50 hover:text-brand-700">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {stats.isLoading ? <LoadingState label="Loading platform statistics" /> : null}
      {stats.error ? <ErrorState message={apiErrorMessage(stats.error, 'Unable to load admin statistics.')} onRetry={() => void stats.refetch()} /> : null}
      {stats.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(({ key, label, icon: Icon, tone }) => (
              <Card key={key} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-xl p-2.5 ${tone === 'danger' ? 'bg-red-50 text-red-700' : tone === 'warning' ? 'bg-yellow-light text-yellow-dark' : tone === 'success' ? 'bg-emerald-50 text-emerald-700' : tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {key === 'pendingReports' && stats.data.overview.pendingReports > 0 ? <Badge tone="warning">Review</Badge> : null}
                </div>
                <p className="mt-5 text-3xl font-black tracking-tight text-ink">{formatNumber(stats.data.overview[key])}</p>
                <p className="mt-1 text-sm font-semibold text-muted">{label}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
            <ChartCard title="User growth" description={`New accounts created over the selected ${range} window.`}>
              {stats.data.userGrowth.length ? (
                <LineChart
                  height={300}
                  margin={{ left: 52, right: 20, top: 16, bottom: 44 }}
                  xAxis={[{ scaleType: 'point', data: dateLabels, tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                  yAxis={[{ tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                  series={[{ data: stats.data.userGrowth.map((point) => point.users), label: 'New users', color: '#77a6f7', area: true, showMark: false }]}
                  sx={{ '& .MuiChartsAxis-line': { stroke: 'var(--border-subtle)' }, '& .MuiChartsAxis-tick': { stroke: 'var(--border-subtle)' }, '& .MuiChartsLegend-root': { color: 'var(--text-secondary)' } }}
                />
              ) : <EmptyState title="No user growth yet" description="New account activity will appear here." />}
            </ChartCard>
            <ChartCard title="Account state" description="Current account distribution across the platform.">
              {stats.data.accountStates.length ? (
                <PieChart
                  height={300}
                  series={[{ data: stats.data.accountStates, innerRadius: 62, paddingAngle: 3, cornerRadius: 5, highlightScope: { fade: 'global', highlight: 'item' } }]}
                  colors={['#77a6f7', '#00887a', '#ffccbb', '#ed3f27', '#52627a']}
                />
              ) : <EmptyState title="No account data" description="Account distribution will appear after users join." />}
            </ChartCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
            <ChartCard title="Content growth" description="New posts, comments, teams, communities, and events by day.">
              <BarChart
                height={320}
                margin={{ left: 52, right: 20, top: 16, bottom: 44 }}
                xAxis={[{ scaleType: 'band', data: stats.data.contentGrowth.map((point) => point.date), tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                yAxis={[{ tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                series={[
                  { data: stats.data.contentGrowth.map((point) => point.posts), label: 'Posts', color: '#77a6f7', stack: 'content' },
                  { data: stats.data.contentGrowth.map((point) => point.comments), label: 'Comments', color: '#00887a', stack: 'content' },
                  { data: stats.data.contentGrowth.map((point) => point.teams), label: 'Teams', color: '#ffccbb', stack: 'content' },
                ]}
                sx={{ '& .MuiChartsAxis-line': { stroke: 'var(--border-subtle)' }, '& .MuiChartsAxis-tick': { stroke: 'var(--border-subtle)' } }}
              />
            </ChartCard>
            <ChartCard title="Platform activity" description="Durable analytics events recorded by the application.">
              <LineChart
                height={320}
                margin={{ left: 52, right: 20, top: 16, bottom: 44 }}
                xAxis={[{ scaleType: 'point', data: stats.data.activity.map((point) => point.date), tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                yAxis={[{ tickLabelStyle: { fontSize: 10, fill: 'var(--text-muted)' } }]}
                series={[{ data: stats.data.activity.map((point) => point.events), label: 'Events', color: '#00887a', showMark: false }]}
                sx={{ '& .MuiChartsAxis-line': { stroke: 'var(--border-subtle)' }, '& .MuiChartsAxis-tick': { stroke: 'var(--border-subtle)' } }}
              />
            </ChartCard>
          </div>
          <p className="text-xs text-muted">Statistics generated {new Date(stats.data.generatedAt).toLocaleString()} from current MongoDB records.</p>
        </>
      ) : null}
    </section>
  );
}
