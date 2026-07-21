import { useEffect, type ReactNode } from 'react';
import { HEALTH_STATUS_COLORS, HEALTH_STATUS_LABELS, type HealthStatus } from '@geoagri/shared';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center text-brand-600">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
};

export function Badge({ color = 'gray', children }: { color?: keyof typeof badgeStyles; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyles[color]}`}>
      {children}
    </span>
  );
}

export function statusBadgeColor(status: string): keyof typeof badgeStyles {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
    case 'ACTIVE':
    case 'EXCELLENT':
    case 'GOOD':
      return 'green';
    case 'PENDING':
    case 'PROCESSING':
    case 'TRIAL':
    case 'MODERATE':
      return 'yellow';
    case 'FAILED':
    case 'REJECTED':
    case 'EXPIRED':
    case 'CRITICAL':
      return 'red';
    case 'POOR':
      return 'orange';
    case 'CANCELLED':
    default:
      return 'gray';
  }
}

export function HealthBadge({ status }: { status: HealthStatus | null }) {
  if (!status) return <Badge color="gray">No data</Badge>;
  return <Badge color={statusBadgeColor(status)}>{HEALTH_STATUS_LABELS[status]}</Badge>;
}

export function HealthScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  const color =
    value >= 70 ? '#16a34a' : value >= 50 ? '#ca8a04' : value >= 30 ? '#ea580c' : '#dc2626';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="8" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="8"
          stroke={score == null ? 'transparent' : color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold">{score ?? '—'}</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">/ 100</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Alert({ kind = 'info', children }: { kind?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
    success: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950/50 dark:text-yellow-200',
    error: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
  } as const;
  return <div className={`rounded-lg border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-3 text-4xl">🛰️</div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={`card relative z-10 max-h-[90vh] w-full overflow-y-auto ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function DistributionBar({
  distribution,
}: {
  distribution: { critical: number; poor: number; moderate: number; good: number; excellent: number };
}) {
  const bands: Array<{ key: HealthStatus; fraction: number }> = [
    { key: 'CRITICAL', fraction: distribution.critical },
    { key: 'POOR', fraction: distribution.poor },
    { key: 'MODERATE', fraction: distribution.moderate },
    { key: 'GOOD', fraction: distribution.good },
    { key: 'EXCELLENT', fraction: distribution.excellent },
  ];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {bands.map((b) => (
          <div
            key={b.key}
            style={{ width: `${b.fraction * 100}%`, background: HEALTH_STATUS_COLORS[b.key] }}
            title={`${HEALTH_STATUS_LABELS[b.key]}: ${(b.fraction * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {bands.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: HEALTH_STATUS_COLORS[b.key] }} />
            {HEALTH_STATUS_LABELS[b.key]} {(b.fraction * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}
