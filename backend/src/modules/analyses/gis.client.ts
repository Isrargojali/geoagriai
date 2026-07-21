import type { FarmGeometry } from '@geoagri/shared';
import { env } from '../../config/env.js';
import { UpstreamError } from '../../lib/errors.js';

/** Response shape of the Python GIS service (snake_case on the wire). */
export interface GisNdviResponse {
  provider: 'gee' | 'synthetic';
  image_date: string;
  cloud_cover: number;
  statistics: {
    min: number;
    max: number;
    mean: number;
    std_dev: number;
    median: number;
    distribution: {
      critical: number;
      poor: number;
      moderate: number;
      good: number;
      excellent: number;
    };
    pixel_count: number;
  };
  png_base64: string;
  bounds: [[number, number], [number, number]];
}

export interface GisWeatherResponse {
  current: {
    temperature_c: number;
    humidity_pct: number;
    rainfall_mm: number;
    wind_speed_kmh: number;
    wind_direction_deg: number;
    weather_code: number;
    fetched_at: string;
  };
  forecast: Array<{
    date: string;
    temp_min_c: number;
    temp_max_c: number;
    rainfall_mm: number;
    humidity_pct: number;
    wind_speed_kmh: number;
    weather_code: number;
  }>;
}

async function gisRequest<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.PYTHON_SERVICE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.GIS_SERVICE_API_KEY,
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new UpstreamError(
      'The GIS service is unreachable. Please try again shortly.',
      { cause: String(err) },
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // non-JSON error body — keep the HTTP status message
    }
    throw new UpstreamError(detail);
  }

  return (await response.json()) as T;
}

/** Request an NDVI analysis for a farm geometry from the GIS service. */
export async function requestNdviAnalysis(params: {
  geometry: FarmGeometry;
  endDate?: string;
  windowDays: number;
}): Promise<GisNdviResponse> {
  return gisRequest<GisNdviResponse>(
    '/analyze/ndvi',
    {
      method: 'POST',
      body: JSON.stringify({
        geometry: params.geometry,
        end_date: params.endDate ?? null,
        window_days: params.windowDays,
      }),
    },
    180_000,
  );
}

/** Fetch current weather + 7-day forecast for a location. */
export async function requestWeather(lat: number, lng: number): Promise<GisWeatherResponse> {
  return gisRequest<GisWeatherResponse>(
    `/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    { method: 'GET' },
    30_000,
  );
}
