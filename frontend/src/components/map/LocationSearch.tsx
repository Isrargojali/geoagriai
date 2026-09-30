import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { GeoSearchResultDto } from '@geoagri/shared';
import { searchLocations } from '@/api/hooks';
import { ApiRequestError } from '@/lib/api';
import { Spinner } from '@/components/ui';

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

/**
 * Floating "search a place" box for the farm boundary map — lets a user jump
 * to an address/region before drawing, instead of manually panning/zooming.
 */
export function LocationSearch() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoSearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Stop map drag/zoom/dblclick from firing when interacting with the box.
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchLocations(trimmed, controller.signal)
        .then((res) => {
          setResults(res);
          setError(null);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof ApiRequestError ? err.message : 'Search failed');
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectResult = (result: GeoSearchResultDto) => {
    map.flyTo([result.lat, result.lng], 15);
    setQuery(result.label);
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="leaflet-top leaflet-left" ref={containerRef}>
      <div className="leaflet-control m-2 w-64 sm:w-80">
        <div className="relative">
          <input
            type="text"
            className="input w-full !bg-white text-sm shadow-md dark:!bg-slate-800"
            placeholder="Search for a place or address…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Spinner className="h-4 w-4" />
            </div>
          )}
          {open && (error || results.length > 0) && (
            <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800">
              {error && <li className="px-3 py-2 text-red-600 dark:text-red-400">{error}</li>}
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                    onClick={() => selectResult(r)}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
