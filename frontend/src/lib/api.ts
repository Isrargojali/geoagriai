import type { ApiError, AuthTokens } from '@geoagri/shared';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

const TOKEN_KEY = 'geoagri.tokens';

export function getTokens(): AuthTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens | null): void {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const tokens = getTokens();
      if (!tokens?.refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { tokens: AuthTokens };
        setTokens(data.tokens);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Raw FormData body for multipart uploads. */
  formData?: FormData;
  signal?: AbortSignal;
}

/** Authenticated JSON API client with automatic token refresh on 401. */
export async function api<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const tokens = getTokens();
  const headers: Record<string, string> = {};
  if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? (options.body !== undefined || options.formData ? 'POST' : 'GET'),
    headers,
    body:
      options.formData ??
      (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    signal: options.signal,
  });

  if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) return api<T>(path, options, true);
    setTokens(null);
    window.dispatchEvent(new CustomEvent('geoagri:logout'));
  }

  if (!response.ok) {
    let error: ApiError = {
      statusCode: response.status,
      error: 'REQUEST_ERROR',
      message: `Request failed (${response.status})`,
    };
    try {
      error = (await response.json()) as ApiError;
    } catch {
      // keep the fallback error
    }
    throw new ApiRequestError(error.statusCode, error.error, error.message, error.details);
  }

  return (await response.json()) as T;
}

/** Fetch a protected binary resource (NDVI overlay, proof, report) as an object URL. */
export async function fetchProtectedBlobUrl(path: string): Promise<string> {
  const tokens = getTokens();
  const response = await fetch(`${API_BASE_URL}${path.replace(/^\/api\/v1/, '')}`, {
    headers: tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
  });
  if (!response.ok) throw new ApiRequestError(response.status, 'FILE_ERROR', 'Could not load file');
  return URL.createObjectURL(await response.blob());
}

/** Trigger a download of a protected file. */
export async function downloadProtectedFile(path: string, fileName: string): Promise<void> {
  const url = await fetchProtectedBlobUrl(path);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
