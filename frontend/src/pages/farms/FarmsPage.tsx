import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeleteFarm, useFarms, useUsage } from '@/api/hooks';
import { Alert, Card, EmptyState, HealthBadge, Modal, PageSpinner } from '@/components/ui';
import { formatArea, formatDate } from '@/lib/format';
import type { FarmDto, HealthStatus } from '@geoagri/shared';

export function FarmsPage() {
  const { data: farms, isLoading } = useFarms();
  const { data: usage } = useUsage();
  const deleteFarm = useDeleteFarm();
  const [toDelete, setToDelete] = useState<FarmDto | null>(null);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Farms</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {usage?.farms.limit != null
              ? `${usage.farms.used} of ${usage.farms.limit} farms used on your plan`
              : `${farms?.length ?? 0} farms`}
          </p>
        </div>
        {usage?.canCreateFarm !== false && (
          <Link to="/farms/new" className="btn-primary">+ Add farm</Link>
        )}
      </div>

      {usage && !usage.canCreateFarm && (
        <Alert kind="warning">
          {usage.blockedReason ??
            'You have reached your plan’s farm limit. Upgrade in Billing to add more farms.'}
        </Alert>
      )}

      {farms && farms.length === 0 ? (
        <Card>
          <EmptyState
            title="No farms yet"
            message="Draw your farm boundary on a satellite map, or upload an existing GeoJSON/KML file."
            action={<Link to="/farms/new" className="btn-primary">Create your first farm</Link>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(farms ?? []).map((farm) => (
            <div key={farm.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/farms/${farm.id}`} className="font-semibold hover:text-brand-600">
                    {farm.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatArea(farm.areaHectares)}
                    {farm.cropType ? ` · ${farm.cropType}` : ''}
                  </p>
                </div>
                <HealthBadge status={(farm.latestAnalysis?.healthStatus ?? null) as HealthStatus | null} />
              </div>
              <p className="mt-3 line-clamp-2 flex-1 text-sm text-slate-500 dark:text-slate-400">
                {farm.description || 'No description'}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <span>
                  {farm.latestAnalysis
                    ? `Last analysis ${formatDate(farm.latestAnalysis.createdAt)}`
                    : 'Never analyzed'}
                </span>
                <div className="flex gap-2">
                  <Link to={`/farms/${farm.id}/edit`} className="text-brand-600 hover:underline">Edit</Link>
                  <button className="text-red-600 hover:underline" onClick={() => setToDelete(farm)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(toDelete)} title="Delete farm" onClose={() => setToDelete(null)}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete <strong>{toDelete?.name}</strong>? All its analyses, weather history and reports
          will be permanently removed.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>Cancel</button>
          <button
            className="btn-danger"
            disabled={deleteFarm.isPending}
            onClick={() => {
              if (!toDelete) return;
              deleteFarm.mutate(toDelete.id, { onSettled: () => setToDelete(null) });
            }}
          >
            Delete farm
          </button>
        </div>
      </Modal>
    </div>
  );
}
