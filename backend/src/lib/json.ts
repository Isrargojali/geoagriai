/** Helpers for JSON-in-String columns (SQLite). When migrating to PostgreSQL
 *  jsonb these become pass-throughs. */

export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined): T | null {
  if (value == null || value === '') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
