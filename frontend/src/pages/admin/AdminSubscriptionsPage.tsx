import { useState } from 'react';
import { useAdminCancelSubscription, useAdminSubscriptions } from '@/api/admin';
import { Pagination } from '@/components/Pagination';
import { Badge, Card, PageSpinner, statusBadgeColor } from '@/components/ui';
import { formatDate } from '@/lib/format';

export function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminSubscriptions(page);
  const cancel = useAdminCancelSubscription();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <Card>
        {isLoading || !data ? (
          <PageSpinner />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Start</th>
                    <th className="py-2 pr-4">Ends</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{s.user.name}</p>
                        <p className="text-xs text-slate-500">{s.user.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">{s.plan.name}</td>
                      <td className="py-2.5 pr-4">
                        <Badge color={statusBadgeColor(s.status)}>{s.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDate(s.startDate)}</td>
                      <td className="py-2.5 pr-4 text-slate-500">
                        {formatDate(s.trialEndsAt ?? s.endDate)}
                      </td>
                      <td className="py-2.5 text-right">
                        {(s.status === 'ACTIVE' || s.status === 'TRIAL') && (
                          <button
                            className="text-xs text-red-600 hover:underline"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(s.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
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
