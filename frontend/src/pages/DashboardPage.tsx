import { Link } from 'react-router-dom';
import { useFarms, useSubscription, useUsage, useWeather } from '@/api/hooks';
import { FarmMap } from '@/components/map/FarmMap';
import {
  Alert,
  Card,
  EmptyState,
  HealthBadge,
  HealthScoreRing,
  PageSpinner,
  StatCard,
} from '@/components/ui';
import { formatArea, formatDate, formatNdvi } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { HealthStatus } from '@geoagri/shared';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: farms, isLoading } = useFarms();
  const { data: usage } = useUsage();
  const { data: subscription } = useSubscription();
  const firstFarm = farms?.[0];
  const { data: weather } = useWeather(firstFarm?.id);

  if (isLoading) return <PageSpinner />;

  const latestWithAnalysis = farms?.find((f) => f.latestAnalysis?.status === 'COMPLETED');
  const latest = latestWithAnalysis?.latestAnalysis ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.firstName} 👋</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {subscription
              ? `${subscription.plan.name} plan · ${subscription.status === 'TRIAL' ? `${subscription.daysRemaining} trial days left` : subscription.status.toLowerCase()}`
              : 'Loading subscription…'}
          </p>
        </div>
        <Link to="/farms/new" className="btn-primary">+ Add farm</Link>
      </div>

      {usage?.blockedReason && <Alert kind="warning">{usage.blockedReason}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Farms"
          value={`${usage?.farms.used ?? farms?.length ?? 0}${usage?.farms.limit != null ? ` / ${usage.farms.limit}` : ''}`}
        />
        <StatCard
          label="Analyses today"
          value={`${usage?.analysesToday.used ?? 0}${usage?.analysesToday.limit != null ? ` / ${usage.analysesToday.limit}` : ''}`}
        />
        <StatCard
          label="Total analyses"
          value={`${usage?.analysesTotal.used ?? 0}${usage?.analysesTotal.limit != null ? ` / ${usage.analysesTotal.limit}` : ''}`}
        />
        <StatCard
          label="Current weather"
          value={weather ? `${weather.current.temperatureC.toFixed(0)}°C` : '—'}
          hint={weather ? `${weather.current.description} · ${firstFarm?.name}` : 'Add a farm to see weather'}
        />
      </div>

      {farms && farms.length === 0 ? (
        <Card>
          <EmptyState
            title="No farms yet"
            message="Create your first farm by drawing its boundary on the map or uploading a GeoJSON/KML file, then run your first satellite analysis."
            action={<Link to="/farms/new" className="btn-primary">Create your first farm</Link>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Farm map" className="lg:col-span-2">
            <FarmMap farms={farms ?? []} height="h-[26rem]" />
          </Card>

          <div className="space-y-6">
            <Card title="Latest crop health">
              {latest ? (
                <div className="flex items-center gap-4">
                  <HealthScoreRing score={latest.healthScore} />
                  <div className="space-y-1">
                    <HealthBadge status={latest.healthStatus as HealthStatus | null} />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {latestWithAnalysis?.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      NDVI {formatNdvi(latest.ndviMean)} · {formatDate(latest.imageDate)}
                    </p>
                    <Link
                      to={`/analyses/${latest.id}`}
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      View analysis →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Run your first analysis from a farm page to see crop health here.
                </p>
              )}
            </Card>

            <Card title="Your farms">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {(farms ?? []).slice(0, 6).map((farm) => (
                  <li key={farm.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <Link
                        to={`/farms/${farm.id}`}
                        className="text-sm font-medium hover:text-brand-600"
                      >
                        {farm.name}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatArea(farm.areaHectares)}
                        {farm.cropType ? ` · ${farm.cropType}` : ''}
                      </p>
                    </div>
                    <HealthBadge
                      status={(farm.latestAnalysis?.healthStatus ?? null) as HealthStatus | null}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
