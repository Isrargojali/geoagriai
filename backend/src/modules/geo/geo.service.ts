import type { GeoSearchResultDto } from '@geoagri/shared';
import { env } from '../../config/env.js';
import { UpstreamError } from '../../lib/errors.js';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Look up place names / addresses for the farm boundary map search box. */
export async function searchPlaces(query: string): Promise<GeoSearchResultDto[]> {
  const url = `${env.GEOCODING_BASE_URL}/search?format=jsonv2&limit=6&q=${encodeURIComponent(query)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        // Nominatim usage policy requires an identifying User-Agent.
        'User-Agent': 'GeoAgriAI/1.0 (https://geoagri.ai)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    throw new UpstreamError('Location search is temporarily unavailable', {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  if (!response.ok) {
    throw new UpstreamError('Location search is temporarily unavailable');
  }

  const results = (await response.json()) as NominatimResult[];
  return results.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
