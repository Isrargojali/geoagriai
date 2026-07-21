import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAdminPayments,
  useApprovePayment,
  useRejectPayment,
  type AdminPayment,
} from '@/api/admin';
import { AuthImage } from '@/components/AuthImage';
import { Pagination } from '@/components/Pagination';
import { Alert, Badge, Card, Modal, PageSpinner, Spinner, statusBadgeColor } from '@/components/ui';
import { formatDate, formatDateTime, formatUsd } from '@/lib/format';

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;

export function AdminPaymentsPage() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as (typeof STATUS_TABS)[number]) || 'PENDING';
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminPayments(status === 'ALL' ? undefined : status, page);
  const approve = useApprovePayment();
  const reject = useRejectPayment();

  const [reviewing, setReviewing] = useState<AdminPayment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReviewing(null);
    setRejectReason('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>

      <div className="flex gap-1 rounded-lg border border-slate-200 p-1 text-sm dark:border-slate-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${
              status === tab
                ? 'bg-brand-700 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            onClick={() => {
              setPage(1);
              setParams(tab === 'PENDING' ? {} : { status: tab });
            }}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <Card>
        {isLoading || !data ? (
          <PageSpinner />
        ) : data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No {status.toLowerCase()} payments.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                  <tr>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Proof</th>
                    <th className="py-2 pr-4">Submitted</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium">{p.user.name}</p>
                        <p className="text-xs text-slate-500">{p.user.email}</p>
                      </td>
                      <td className="py-2.5 pr-4">{p.planName}</td>
                      <td className="py-2.5 pr-4">{formatUsd(p.amountUsd)}</td>
                      <td className="py-2.5 pr-4">{p.method.replace('_', ' ')}</td>
                      <td className="py-2.5 pr-4">{p.proof ? '✓ uploaded' : '— none'}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{formatDateTime(p.createdAt)}</td>
                      <td className="py-2.5 pr-4">
                        <Badge color={statusBadgeColor(p.status)}>{p.status}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <button className="text-brand-600 hover:underline" onClick={() => setReviewing(p)}>
                          Review
                        </button>
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

      <Modal open={Boolean(reviewing)} title="Review payment" onClose={close} wide>
        {reviewing && (
          <div className="space-y-4">
            {error && <Alert kind="error">{error}</Alert>}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-500">User:</span> {reviewing.user.name} ({reviewing.user.email})</p>
                <p><span className="text-slate-500">Plan:</span> {reviewing.planName} — {formatUsd(reviewing.amountUsd)}</p>
                <p><span className="text-slate-500">Method:</span> {reviewing.method.replace('_', ' ')}</p>
                {reviewing.proof ? (
                  <>
                    <p><span className="text-slate-500">Transaction ID:</span> <span className="font-mono">{reviewing.proof.transactionId}</span></p>
                    <p><span className="text-slate-500">Paid amount:</span> {formatUsd(reviewing.proof.amount)}</p>
                    <p><span className="text-slate-500">Payment date:</span> {formatDate(reviewing.proof.paymentDate)}</p>
                    {reviewing.proof.notes && (
                      <p><span className="text-slate-500">Notes:</span> {reviewing.proof.notes}</p>
                    )}
                  </>
                ) : (
                  <Alert kind="warning">The user has not uploaded payment proof yet.</Alert>
                )}
                {reviewing.status === 'REJECTED' && reviewing.rejectReason && (
                  <Alert kind="error">Rejected: {reviewing.rejectReason}</Alert>
                )}
              </div>
              <div>
                {reviewing.proof && (
                  <AuthImage
                    src={reviewing.proof.screenshotUrl}
                    alt="Payment proof screenshot"
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                  />
                )}
              </div>
            </div>

            {reviewing.status === 'PENDING' && (
              <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <div>
                  <label className="label" htmlFor="reason">Rejection reason (required to reject)</label>
                  <input
                    id="reason"
                    className="input"
                    placeholder="e.g. Transaction ID not found in bank statement"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="btn-danger"
                    disabled={reject.isPending || rejectReason.trim().length < 3}
                    onClick={() =>
                      reject.mutate(
                        { paymentId: reviewing.id, reason: rejectReason.trim() },
                        {
                          onSuccess: close,
                          onError: (err) => setError(err instanceof Error ? err.message : 'Reject failed'),
                        },
                      )
                    }
                  >
                    {reject.isPending && <Spinner className="h-4 w-4" />} Reject
                  </button>
                  <button
                    className="btn-primary"
                    disabled={approve.isPending || !reviewing.proof}
                    onClick={() =>
                      approve.mutate(reviewing.id, {
                        onSuccess: close,
                        onError: (err) => setError(err instanceof Error ? err.message : 'Approve failed'),
                      })
                    }
                  >
                    {approve.isPending && <Spinner className="h-4 w-4" />} Approve & activate subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
