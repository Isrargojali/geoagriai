export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="btn-secondary px-3 py-1" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Prev
      </button>
      <span className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn-secondary px-3 py-1"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
