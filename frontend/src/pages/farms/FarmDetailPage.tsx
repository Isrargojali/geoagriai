import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { HealthStatus } from '@geoagri/shared';
import {
  useAnalyses,
  useAnalysisHistory,
  useFarm,
  useGenerateReport,
  useRunAnalysis,
  useUsage,
  useWeather,
} from '@/api/hooks';
import { ApiRequestError, downloadProtectedFile } from '@/lib/api';
import { FarmMap, type NdviOverlay } from '@/components/map/FarmMap';
import { ForecastChart, NdviHistoryChart } from '@/components/charts';
import {
  Alert,
  Badge,
  Card,
  DistributionBar,
  HealthBadge,
  HealthScoreRing,
  PageSpinner,
  Spinner,
  statusBadgeColor,
} from '@/components/ui';
import { formatArea, formatDate, formatDateTime, formatNdvi } from '@/lib/format';

export function FarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: farm, isLoading } = useFarm(farmId);
  const { data: analyses } = useAnalyses(farmId);
  const { data: history } = useAnalysisHistory(farmId);
  const { data: weather } = useWeather(farmId);
  const { data: usage } = useUsage();
  const runAnalysis = useRunAnalysis(farmId ?? '');
  const generateReport = useGenerateReport();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const latestCompleted = useMemo(
    () => analyses?.items.find((a) => a.status === 'COMPLETED' && a.ndviImageUrl),
    [analyses],
  );

  const overlay: NdviOverlay | null =
    showOverlay && latestCompleted?.ndviImageUrl && latestCompleted.imageBounds
      ? { imageUrl: latestCompleted.ndviImageUrl, bounds: latestCompleted.imageBounds }
      : null;

  if (isLoading || !farm) return <PageSpinner />;

  const onRunAnalysis = () => {
    setError(null);
    setNotice(null);
    runAnalysis.mutate(undefined, {
      onSuccess: (analysis) => {
        if (analysis.status === 'FAILED') {
          setError(analysis.error ?? 'Analysis failed');
        } else {
          setNotice(
            `Analysis complete — health score ${analysis.healthScore}/100 (image from ${formatDate(analysis.imageDate)}).`,
          );
        }
      },
      onError: (err) =>
        setError(err instanceof ApiRequestError ? err.message : 'Analysis request failed'),
    });
  };

  const onReport = (type: 'PDF' | 'CSV') => {
    setError(null);
    generateReport.mutate(
      { farmId: farm.id, type, analysisId: type === 'PDF' ? latestCompleted?.id : undefined },
      {
        onSuccess: (report) => {
          void downloadProtectedFile(report.downloadUrl, report.fileName);
          setNotice(`${type} report generated — download should start automatically.`);
        },
        onError: (err) =>
          setError(err instanceof ApiRequestError ? err.message : 'Report generation failed'),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{farm.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatArea(farm.areaHectares)}
            {farm.cropType ? ` · ${farm.cropType}` : ''}
            {farm.plantingDate ? ` · planted ${formatDate(farm.plantingDate)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigate(`/farms/${farm.id}/edit`)}>
            Edit
          </button>
          <button
            className="btn-secondary"
            disabled={generateReport.isPending || !latestCompleted}
            onClick={() => onReport('CSV')}
          >
            CSV export
          </button>
          <button
            className="btn-secondary"
            disabled={generateReport.isPending || !latestCompleted}
            onClick={() => onReport('PDF')}
          >
            {generateReport.isPending ? <Spinner className="h-4 w-4" /> : null} PDF report
          </button>
          <button
            className="btn-primary"
            disabled={runAnalysis.isPending || usage?.canRunAnalysis === false}
            onClick={onRunAnalysis}
          >
            {runAnalysis.isPending ? <Spinner className="h-4 w-4" /> : '🛰️'}
            {runAnalysis.isPending ? ' Analyzing…' : ' Run analysis'}
          </button>
        </div>
      </div>

      {usage && !usage.canRunAnalysis && (
        <Alert kind="warning">
          {usage.blockedReason ?? 'You have reached your analysis limit. Upgrade in Billing to continue.'}
        </Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      {runAnalysis.isPending && (
        <Alert kind="info">
          Retrieving Sentinel-2 imagery, computing NDVI and generating recommendations. This can
          take up to two minutes for large farms.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="Field map"
          className="lg:col-span-2"
          actions={
            latestCompleted && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                />
                NDVI overlay
              </label>
            )
          }
        >
          <FarmMap farms={[farm]} overlay={overlay} height="h-[26rem]" />
          {latestCompleted?.statistics && (
            <div className="mt-4">
              <DistributionBar distribution={latestCompleted.statistics.distribution} />
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Crop health">
            {latestCompleted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <HealthScoreRing score={latestCompleted.healthScore} />
                  <div className="space-y-1 text-sm">
                    <HealthBadge status={latestCompleted.healthStatus as HealthStatus | null} />
                    <p className="text-slate-500 dark:text-slate-400">
                      NDVI {formatNdvi(latestCompleted.ndviMean)}
                      {latestCompleted.ndviChange != null && (
                        <span
                          className={
                            latestCompleted.ndviChange >= 0 ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {' '}
                          ({latestCompleted.ndviChange >= 0 ? '+' : ''}
                          {latestCompleted.ndviChange.toFixed(2)})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Image {formatDate(latestCompleted.imageDate)} · clouds{' '}
                      {latestCompleted.cloudCover?.toFixed(0)}%
                    </p>
                  </div>
                </div>
                {latestCompleted.recommendation && (
                  <div
                    className={`rounded-lg border p-3 text-sm ${
                      latestCompleted.recommendation.severity === 'critical'
                        ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
                        : latestCompleted.recommendation.severity === 'warning'
                          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40'
                          : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40'
                    }`}
                  >
                    <p className="font-medium">{latestCompleted.recommendation.summary}</p>
                    <Link
                      to={`/analyses/${latestCompleted.id}`}
                      className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                    >
                      Full recommendation & reasoning →
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No completed analysis yet. Run your first satellite analysis to see crop health.
              </p>
            )}
          </Card>

          <Card title="Weather">
            {weather ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{weather.current.temperatureC.toFixed(0)}°C</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {weather.current.description}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <p>💧 {weather.current.humidityPct.toFixed(0)}% humidity</p>
                    <p>🌧️ {weather.current.rainfallMm.toFixed(1)} mm rain</p>
                    <p>💨 {weather.current.windSpeedKmh.toFixed(0)} km/h wind</p>
                  </div>
                </div>
                <div className="h-44">
                  <ForecastChart days={weather.forecast} />
                </div>
              </div>
            ) : (
              <PageSpinner />
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="NDVI history">
          {history && history.length >= 2 ? (
            <div className="h-64">
              <NdviHistoryChart points={history} />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Run at least two analyses to see the NDVI trend over time.
            </p>
          )}
        </Card>

        <Card title="Analysis history">
          {analyses && analyses.items.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {analyses.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <Link to={`/analyses/${a.id}`} className="font-medium hover:text-brand-600">
                      {formatDateTime(a.createdAt)}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {a.status === 'COMPLETED'
                        ? `NDVI ${formatNdvi(a.ndviMean)} · score ${a.healthScore}/100`
                        : a.error ?? a.status.toLowerCase()}
                    </p>
                  </div>
                  <Badge color={statusBadgeColor(a.status)}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No analyses yet.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
