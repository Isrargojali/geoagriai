import { Link, useParams } from 'react-router-dom';
import type { HealthStatus } from '@geoagri/shared';
import { useAnalysis, useFarm } from '@/api/hooks';
import { FarmMap } from '@/components/map/FarmMap';
import {
  Alert,
  Badge,
  Card,
  DistributionBar,
  HealthBadge,
  HealthScoreRing,
  PageSpinner,
  statusBadgeColor,
} from '@/components/ui';
import { formatDate, formatDateTime, formatNdvi } from '@/lib/format';

export function AnalysisDetailPage() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const { data: analysis, isLoading } = useAnalysis(analysisId);
  const { data: farm } = useFarm(analysis?.farmId);

  if (isLoading || !analysis) return <PageSpinner />;

  const severityKind =
    analysis.recommendation?.severity === 'critical'
      ? 'error'
      : analysis.recommendation?.severity === 'warning'
        ? 'warning'
        : 'info';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">NDVI Analysis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {farm ? (
              <Link to={`/farms/${farm.id}`} className="text-brand-600 hover:underline">
                {farm.name}
              </Link>
            ) : (
              '…'
            )}{' '}
            · requested {formatDateTime(analysis.createdAt)}
          </p>
        </div>
        <Badge color={statusBadgeColor(analysis.status)}>{analysis.status}</Badge>
      </div>

      {analysis.status === 'FAILED' && (
        <Alert kind="error">{analysis.error ?? 'This analysis failed.'}</Alert>
      )}

      {analysis.status === 'COMPLETED' && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="NDVI health map" className="lg:col-span-2">
              {farm && analysis.ndviImageUrl && analysis.imageBounds ? (
                <FarmMap
                  farms={[farm]}
                  overlay={{ imageUrl: analysis.ndviImageUrl, bounds: analysis.imageBounds }}
                  height="h-[26rem]"
                />
              ) : (
                <p className="text-sm text-slate-500">Map unavailable</p>
              )}
              {analysis.statistics && (
                <div className="mt-4">
                  <DistributionBar distribution={analysis.statistics.distribution} />
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card title="Health score">
                <div className="flex items-center gap-4">
                  <HealthScoreRing score={analysis.healthScore} />
                  <div className="space-y-1 text-sm">
                    <HealthBadge status={analysis.healthStatus as HealthStatus | null} />
                    <p className="text-slate-500 dark:text-slate-400">
                      Image date {formatDate(analysis.imageDate)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Cloud cover {analysis.cloudCover?.toFixed(1)}%
                    </p>
                    {analysis.ndviChange != null && (
                      <p
                        className={`text-xs font-medium ${analysis.ndviChange >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {analysis.ndviChange >= 0 ? '▲' : '▼'} {Math.abs(analysis.ndviChange).toFixed(2)}{' '}
                        vs previous analysis
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {analysis.statistics && (
                <Card title="NDVI statistics">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {(
                      [
                        ['Mean', analysis.statistics.mean],
                        ['Median', analysis.statistics.median],
                        ['Minimum', analysis.statistics.min],
                        ['Maximum', analysis.statistics.max],
                        ['Std. dev.', analysis.statistics.stdDev],
                      ] as Array<[string, number]>
                    ).map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                        <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                        <dd className="font-medium">{formatNdvi(value)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between py-1">
                      <dt className="text-slate-500 dark:text-slate-400">Pixels</dt>
                      <dd className="font-medium">{analysis.statistics.pixelCount.toLocaleString()}</dd>
                    </div>
                  </dl>
                </Card>
              )}

              {analysis.weather && (
                <Card title="Weather at analysis">
                  <p className="text-sm">
                    {analysis.weather.description} · {analysis.weather.temperatureC.toFixed(1)}°C
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Humidity {analysis.weather.humidityPct.toFixed(0)}% · rain{' '}
                    {analysis.weather.rainfallMm.toFixed(1)} mm · wind{' '}
                    {analysis.weather.windSpeedKmh.toFixed(0)} km/h
                  </p>
                </Card>
              )}
            </div>
          </div>

          {analysis.recommendation && (
            <Card title="AI recommendation">
              <Alert kind={severityKind}>
                <p className="font-semibold">{analysis.recommendation.summary}</p>
              </Alert>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Recommended actions</h4>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {analysis.recommendation.actions.map((action, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-brand-600">✔</span> {action}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Why this recommendation</h4>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {analysis.recommendation.reasons.map((reason, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-slate-400">•</span> {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                NDVI and all vegetation statistics are computed by the GIS service from Sentinel-2
                imagery — the AI layer only interprets those results and always explains its
                reasoning. Recommendations do not replace professional agronomic advice.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
