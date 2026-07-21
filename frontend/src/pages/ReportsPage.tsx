import { useState } from 'react';
import { useFarms, useGenerateReport, useReports } from '@/api/hooks';
import { downloadProtectedFile } from '@/lib/api';
import { Alert, Badge, Card, EmptyState, PageSpinner, Spinner } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export function ReportsPage() {
  const { data: reports, isLoading } = useReports();
  const { data: farms } = useFarms();
  const generate = useGenerateReport();
  const [farmId, setFarmId] = useState('');
  const [type, setType] = useState<'PDF' | 'CSV'>('PDF');
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <PageSpinner />;

  const onGenerate = () => {
    setError(null);
    if (!farmId) {
      setError('Choose a farm first');
      return;
    }
    generate.mutate(
      { farmId, type },
      {
        onSuccess: (report) => void downloadProtectedFile(report.downloadUrl, report.fileName),
        onError: (err) => setError(err instanceof Error ? err.message : 'Generation failed'),
      },
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <Card title="Generate a report">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <label className="label" htmlFor="farm">Farm</label>
            <select id="farm" className="input" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">Select a farm…</option>
              {(farms ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="type">Format</label>
            <select id="type" className="input" value={type} onChange={(e) => setType(e.target.value as 'PDF' | 'CSV')}>
              <option value="PDF">PDF — full crop health report</option>
              <option value="CSV">CSV — analysis data export</option>
            </select>
          </div>
          <button className="btn-primary" onClick={onGenerate} disabled={generate.isPending}>
            {generate.isPending && <Spinner className="h-4 w-4" />} Generate
          </button>
        </div>
        {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      </Card>

      <Card title="Report history">
        {reports && reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <tr>
                  <th className="py-2 pr-4">Farm</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4 font-medium">{r.farmName}</td>
                    <td className="py-2.5 pr-4">
                      <Badge color={r.type === 'PDF' ? 'blue' : 'green'}>{r.type}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(r.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      <button
                        className="text-brand-600 hover:underline"
                        onClick={() => void downloadProtectedFile(r.downloadUrl, r.fileName)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No reports yet"
            message="Generate a PDF crop-health report or CSV data export from any of your farms."
          />
        )}
      </Card>
    </div>
  );
}
