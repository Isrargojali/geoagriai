export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatArea(hectares: number): string {
  return `${hectares.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
}

export function formatUsd(amount: number | null): string {
  if (amount == null) return 'Contact sales';
  return `$${amount.toFixed(2)}`;
}

export function formatNdvi(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(2);
}
