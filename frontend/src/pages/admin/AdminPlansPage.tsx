import { useState, type FormEvent } from 'react';
import type { PlanDto } from '@geoagri/shared';
import { useAdminPlans, useAdminUpdatePlan } from '@/api/admin';
import { Alert, Badge, Card, Modal, PageSpinner, Spinner } from '@/components/ui';
import { formatUsd } from '@/lib/format';

function PlanEditor({ plan, onDone }: { plan: PlanDto; onDone: () => void }) {
  const update = useAdminUpdatePlan();
  const [form, setForm] = useState({
    name: plan.name,
    priceUsd: plan.priceUsd?.toString() ?? '',
    maxFarms: plan.maxFarms?.toString() ?? '',
    maxAnalysesPerDay: plan.maxAnalysesPerDay?.toString() ?? '',
    maxAnalysesTotal: plan.maxAnalysesTotal?.toString() ?? '',
    features: plan.features.join('\n'),
    isActive: plan.isActive,
    isContactSales: plan.isContactSales,
  });
  const [error, setError] = useState<string | null>(null);

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate(
      {
        planId: plan.id,
        plan: {
          name: form.name,
          priceUsd: numOrNull(form.priceUsd),
          billingPeriod: plan.billingPeriod,
          maxFarms: numOrNull(form.maxFarms),
          maxAnalysesPerDay: numOrNull(form.maxAnalysesPerDay),
          maxAnalysesTotal: numOrNull(form.maxAnalysesTotal),
          features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
          isActive: form.isActive,
          isContactSales: form.isContactSales,
        },
      },
      {
        onSuccess: onDone,
        onError: (err) => setError(err instanceof Error ? err.message : 'Update failed'),
      },
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <Alert kind="error">{error}</Alert>}
      <div>
        <label className="label">Name</label>
        <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Price USD/month (blank = contact sales)</label>
          <input className="input" type="number" step="0.01" min="0" value={form.priceUsd}
            onChange={(e) => setForm((f) => ({ ...f, priceUsd: e.target.value }))} />
        </div>
        <div>
          <label className="label">Max farms (blank = unlimited)</label>
          <input className="input" type="number" min="1" value={form.maxFarms}
            onChange={(e) => setForm((f) => ({ ...f, maxFarms: e.target.value }))} />
        </div>
        <div>
          <label className="label">Max analyses/day</label>
          <input className="input" type="number" min="1" value={form.maxAnalysesPerDay}
            onChange={(e) => setForm((f) => ({ ...f, maxAnalysesPerDay: e.target.value }))} />
        </div>
        <div>
          <label className="label">Max analyses total</label>
          <input className="input" type="number" min="1" value={form.maxAnalysesTotal}
            onChange={(e) => setForm((f) => ({ ...f, maxAnalysesTotal: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="label">Features (one per line)</label>
        <textarea className="input" rows={5} value={form.features}
          onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} />
      </div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Active
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.isContactSales}
            onChange={(e) => setForm((f) => ({ ...f, isContactSales: e.target.checked }))} />
          Contact sales
        </label>
      </div>
      <button type="submit" className="btn-primary w-full" disabled={update.isPending}>
        {update.isPending && <Spinner className="h-4 w-4" />} Save plan
      </button>
    </form>
  );
}

export function AdminPlansPage() {
  const { data: plans, isLoading } = useAdminPlans();
  const [editing, setEditing] = useState<PlanDto | null>(null);

  if (isLoading || !plans) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plans</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card key={plan.id} title={plan.name} actions={
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setEditing(plan)}>
              Edit
            </button>
          }>
            <p className="text-2xl font-bold">
              {plan.isContactSales ? 'Custom' : formatUsd(plan.priceUsd)}
            </p>
            <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
              <p>Farms: {plan.maxFarms ?? 'unlimited'}</p>
              <p>Analyses/day: {plan.maxAnalysesPerDay ?? 'unlimited'}</p>
              <p>Analyses total: {plan.maxAnalysesTotal ?? 'unlimited'}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Badge color={plan.isActive ? 'green' : 'red'}>{plan.isActive ? 'Active' : 'Inactive'}</Badge>
              <Badge color="gray">{plan.slug}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(editing)} title={`Edit ${editing?.name}`} onClose={() => setEditing(null)}>
        {editing && <PlanEditor plan={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
