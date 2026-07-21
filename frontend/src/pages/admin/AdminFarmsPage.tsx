import { useState } from 'react';
import { useAdminFarms } from '@/api/admin';
import { Pagination } from '@/components/Pagination';
import { Card, PageSpinner } from '@/components/ui';
import { formatArea, formatDate } from '@/lib/format';

export function AdminFarmsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminFarms(page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">All farms</h1>
      <Card>
        {isLoading || !data ? (
          <PageSpinner />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">Farm</th>
                    <th className="py-2 pr-4">Owner</th>
                    <th className="py-2 pr-4">Area</th>
                    <th className="py-2 pr-4">Crop</th>
                    <th className="py-2 pr-4">Analyses</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5 pr-4 font-medium">{f.name}</td>
                      <td className="py-2.5 pr-4">
                        <p>{f.owner.name}</p>
                        <p className="text-xs text-slate-500">{f.owner.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">{formatArea(f.areaHectares)}</td>
                      <td className="py-2.5 pr-4">{f.cropType ?? '—'}</td>
                      <td className="py-2.5 pr-4">{f.analysisCount}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">
                        {f.centroidLat.toFixed(3)}, {f.centroidLng.toFixed(3)}
                      </td>
                      <td className="py-2.5 text-slate-500">{formatDate(f.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
