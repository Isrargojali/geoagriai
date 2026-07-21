import { Link } from 'react-router-dom';
import { useAdminAnalytics } from '@/api/admin';
import { CountsChart } from '@/components/charts';
import { Card, PageSpinner, StatCard } from '@/components/ui';

export function AdminDashboardPage() {
  const { data, isLoading } = useAdminAnalytics();
  if (isLoading || !data) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Platform overview</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total users" value={data.totalUsers} hint={`${data.trialUsers} on trial`} />
        <StatCard label="Active subscriptions" value={data.activeSubscriptions} />
        <StatCard label="Farms" value={data.totalFarms} hint={`${data.totalAnalyses} analyses run`} />
        <StatCard
          label="Revenue (approved)"
          value={`$${data.revenueUsd.toFixed(2)}`}
          hint={data.pendingPayments > 0 ? `${data.pendingPayments} payments awaiting review` : 'No pending payments'}
          accent={data.pendingPayments > 0 ? 'text-yellow-600' : undefined}
        />
      </div>

      {data.pendingPayments > 0 && (
        <Link
          to="/admin/payments?status=PENDING"
          className="block rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-900 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200"
        >
          ⚠ {data.pendingPayments} payment{data.pendingPayments === 1 ? '' : 's'} awaiting
          verification — review now →
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="New users (30 days)">
          <div className="h-56">
            <CountsChart points={data.usersLast30Days} label="Users" />
          </div>
        </Card>
        <Card title="Analyses (30 days)">
          <div className="h-56">
            <CountsChart points={data.analysesLast30Days} label="Analyses" color="#0ea5e9" />
          </div>
        </Card>
      </div>
    </div>
  );
}
