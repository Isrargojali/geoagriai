import { useState, type FormEvent } from 'react';
import type { PaymentDto, PaymentInstructionsDto, PaymentMethod, PlanDto } from '@geoagri/shared';
import {
  useCreatePayment,
  useMyInvoices,
  useMyPayments,
  usePlans,
  useSubmitProof,
  useSubscription,
  useUsage,
} from '@/api/hooks';
import { downloadProtectedFile } from '@/lib/api';
import { AuthImage } from '@/components/AuthImage';
import {
  Alert,
  Badge,
  Card,
  Modal,
  PageSpinner,
  Spinner,
  statusBadgeColor,
} from '@/components/ui';
import { formatDate, formatDateTime, formatUsd } from '@/lib/format';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  JAZZCASH: 'JazzCash',
  EASYPAISA: 'EasyPaisa',
  BANK_TRANSFER: 'Bank Transfer (IBAN)',
};

function ProofForm({ payment, onDone }: { payment: PaymentDto; onDone: () => void }) {
  const submitProof = useSubmitProof(payment.id);
  const [form, setForm] = useState({
    transactionId: '',
    amount: String(payment.amountUsd),
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError('A payment screenshot is required');
      return;
    }
    const fd = new FormData();
    fd.append('transactionId', form.transactionId);
    fd.append('amount', form.amount);
    fd.append('paymentDate', form.paymentDate);
    fd.append('method', payment.method);
    if (form.notes) fd.append('notes', form.notes);
    fd.append('screenshot', file);
    submitProof.mutate(fd, {
      onSuccess: onDone,
      onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <Alert kind="error">{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Transaction ID *</label>
          <input className="input" required value={form.transactionId}
            onChange={(e) => setForm((f) => ({ ...f, transactionId: e.target.value }))} />
        </div>
        <div>
          <label className="label">Amount (USD) *</label>
          <input className="input" required type="number" step="0.01" min="0" value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="label">Payment date *</label>
        <input className="input" required type="date" value={form.paymentDate}
          onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
      </div>
      <div>
        <label className="label">Screenshot *</label>
        <input className="input" required type="file" accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <label className="label">Notes (optional)</label>
        <textarea className="input" rows={2} value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={submitProof.isPending}>
        {submitProof.isPending && <Spinner className="h-4 w-4" />} Submit proof for verification
      </button>
    </form>
  );
}

function Instructions({ instructions, amount }: { instructions: PaymentInstructionsDto; amount: number }) {
  return (
    <div className="space-y-3">
      <Alert kind="info">
        Pay <strong>{formatUsd(amount)}</strong> (or its PKR equivalent) via{' '}
        <strong>{instructions.label}</strong> using the details below, then upload your payment
        proof. Your subscription activates once our team verifies the payment (usually within 24
        hours).
      </Alert>
      {instructions.fields.length === 0 ? (
        <Alert kind="warning">
          Payment details for this method are not configured yet. Please contact support.
        </Alert>
      ) : (
        <dl className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
          {instructions.fields.map((f) => (
            <div key={f.label} className="flex justify-between gap-4">
              <dt className="text-slate-500 dark:text-slate-400">{f.label}</dt>
              <dd className="font-mono font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {instructions.qrCodeUrl && (
        <div className="text-center">
          <AuthImage src={instructions.qrCodeUrl} alt="Payment QR code" className="mx-auto h-40 w-40 rounded-lg object-contain" />
          <p className="mt-1 text-xs text-slate-500">Scan to pay</p>
        </div>
      )}
    </div>
  );
}

export function BillingPage() {
  const { data: subscription } = useSubscription();
  const { data: usage } = useUsage();
  const { data: plans, isLoading } = usePlans();
  const { data: payments } = useMyPayments();
  const { data: invoices } = useMyInvoices();
  const createPayment = useCreatePayment();

  const [checkoutPlan, setCheckoutPlan] = useState<PlanDto | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('JAZZCASH');
  const [activePayment, setActivePayment] = useState<PaymentDto | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstructionsDto | null>(null);
  const [proofFor, setProofFor] = useState<PaymentDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <PageSpinner />;

  const pendingPayment = payments?.find((p) => p.status === 'PENDING');

  const startCheckout = () => {
    if (!checkoutPlan) return;
    setError(null);
    createPayment.mutate(
      { planId: checkoutPlan.id, method },
      {
        onSuccess: (result) => {
          setActivePayment(result.payment);
          setInstructions(result.instructions);
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Could not start payment'),
      },
    );
  };

  const closeCheckout = () => {
    setCheckoutPlan(null);
    setActivePayment(null);
    setInstructions(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing & Subscription</h1>

      <Card title="Current subscription">
        {subscription ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">{subscription.plan.name}</span>
                <Badge color={statusBadgeColor(subscription.status)}>{subscription.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {subscription.status === 'TRIAL' && subscription.trialEndsAt
                  ? `Trial ends ${formatDate(subscription.trialEndsAt)} (${subscription.daysRemaining} days left)`
                  : subscription.endDate
                    ? `Renews / expires ${formatDate(subscription.endDate)}`
                    : 'No end date'}
              </p>
            </div>
            {usage && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p>Farms: {usage.farms.used}{usage.farms.limit != null ? ` / ${usage.farms.limit}` : ''}</p>
                <p>
                  Analyses today: {usage.analysesToday.used}
                  {usage.analysesToday.limit != null ? ` / ${usage.analysesToday.limit}` : ''}
                </p>
              </div>
            )}
          </div>
        ) : (
          <PageSpinner />
        )}
      </Card>

      {pendingPayment && (
        <Alert kind="info">
          Your payment for the <strong>{pendingPayment.planName}</strong> plan is{' '}
          {pendingPayment.proof ? 'awaiting verification by our team.' : 'awaiting your payment proof — upload it below.'}
          {!pendingPayment.proof && (
            <button className="ml-2 font-medium underline" onClick={() => setProofFor(pendingPayment)}>
              Upload proof
            </button>
          )}
        </Alert>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(plans ?? []).map((plan) => {
            const isCurrent = subscription?.plan.slug === plan.slug && subscription.status === 'ACTIVE';
            return (
              <div
                key={plan.id}
                className={`card flex flex-col p-6 ${plan.slug === 'professional' ? 'ring-2 ring-brand-500' : ''}`}
              >
                {plan.slug === 'professional' && (
                  <span className="mb-2 self-start rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-3xl font-bold">
                  {plan.isContactSales ? 'Custom' : formatUsd(plan.priceUsd)}
                  {!plan.isContactSales && (
                    <span className="text-sm font-normal text-slate-500">/month</span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-brand-600">✔</span>{f}</li>
                  ))}
                </ul>
                {plan.isContactSales ? (
                  <a href="mailto:sales@geoagri.ai" className="btn-secondary mt-5 w-full">Contact sales</a>
                ) : isCurrent ? (
                  <button className="btn-secondary mt-5 w-full" disabled>Current plan</button>
                ) : (
                  <button
                    className="btn-primary mt-5 w-full"
                    disabled={Boolean(pendingPayment)}
                    onClick={() => setCheckoutPlan(plan)}
                  >
                    Choose {plan.name}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Payment history">
          {payments && payments.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.planName} · {formatUsd(p.amountUsd)} · {METHOD_LABELS[p.method as PaymentMethod]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(p.createdAt)}
                      {p.status === 'REJECTED' && p.rejectReason ? ` — ${p.rejectReason}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === 'PENDING' && !p.proof && (
                      <button className="text-xs text-brand-600 hover:underline" onClick={() => setProofFor(p)}>
                        Upload proof
                      </button>
                    )}
                    <Badge color={statusBadgeColor(p.status)}>{p.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No payments yet.</p>
          )}
        </Card>

        <Card title="Invoices">
          {invoices && invoices.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-mono font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {inv.planName} · {formatUsd(inv.amountUsd)} · {formatDate(inv.issuedAt)}
                    </p>
                  </div>
                  <button
                    className="text-brand-600 hover:underline"
                    onClick={() => void downloadProtectedFile(inv.downloadUrl, `${inv.invoiceNumber}.pdf`)}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No invoices yet.</p>
          )}
        </Card>
      </div>

      {/* Checkout modal */}
      <Modal
        open={Boolean(checkoutPlan)}
        title={activePayment ? `Pay for ${checkoutPlan?.name}` : `Subscribe to ${checkoutPlan?.name}`}
        onClose={closeCheckout}
      >
        {error && <div className="mb-3"><Alert kind="error">{error}</Alert></div>}
        {!activePayment ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {checkoutPlan?.name} — <strong>{formatUsd(checkoutPlan?.priceUsd ?? null)}/month</strong>.
              Choose how you would like to pay:
            </p>
            <div className="space-y-2">
              {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                <label
                  key={m}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                    method === m
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                  />
                  {METHOD_LABELS[m]}
                </label>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={startCheckout} disabled={createPayment.isPending}>
              {createPayment.isPending && <Spinner className="h-4 w-4" />} Continue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {instructions && <Instructions instructions={instructions} amount={activePayment.amountUsd} />}
            <button
              className="btn-primary w-full"
              onClick={() => {
                setProofFor(activePayment);
                closeCheckout();
              }}
            >
              I have paid — upload proof
            </button>
          </div>
        )}
      </Modal>

      {/* Proof upload modal */}
      <Modal open={Boolean(proofFor)} title="Upload payment proof" onClose={() => setProofFor(null)}>
        {proofFor && <ProofForm payment={proofFor} onDone={() => setProofFor(null)} />}
      </Modal>
    </div>
  );
}
