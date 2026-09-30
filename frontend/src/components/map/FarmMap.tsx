import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, ImageOverlay, LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { FarmDto, FarmGeometry } from '@geoagri/shared';
import { fetchProtectedBlobUrl } from '@/lib/api';

/** Compute Leaflet bounds for a Polygon/MultiPolygon geometry. */
export function geometryBounds(geometry: FarmGeometry): L.LatLngBounds {
  const positions: Array<[number, number]> = [];
  const rings =
    geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const [lng, lat] of ring) positions.push([lat, lng]);
  }
  return L.latLngBounds(positions);
}

function FitBounds({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

const boundaryStyle = {
  color: '#16a34a',
  weight: 2.5,
  fillColor: '#22c55e',
  fillOpacity: 0.08,
};

export const basemaps = {
  imagery: {
    name: 'Satellite',
    attribution:
      'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
  streets: {
    name: 'Street',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
  },
  topo: {
    name: 'Topo',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
  },
};

export interface NdviOverlay {
  /** Protected API path of the overlay PNG. */
  imageUrl: string;
  /** [[minLng,minLat],[maxLng,maxLat]] */
  bounds: [[number, number], [number, number]];
}

/**
 * Read-only farm map: OSM base layer + satellite layer, boundary polygon and
 * optional NDVI overlay.
 */
export function FarmMap({
  farms,
  overlay,
  height = 'h-96',
  satellite = true,
}: {
  farms: FarmDto[];
  overlay?: NdviOverlay | null;
  height?: string;
  satellite?: boolean;
}) {
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setOverlayUrl(null);
    if (overlay) {
      fetchProtectedBlobUrl(overlay.imageUrl)
        .then((u) => {
          if (cancelled) {
            URL.revokeObjectURL(u);
            return;
          }
          objectUrl = u;
          setOverlayUrl(u);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [overlay]);

  const bounds = useMemo(() => {
    const all = farms
      .filter((f) => f.boundary)
      .map((f) => geometryBounds(f.boundary!.geometry));
    if (all.length === 0) return null;
    return all.reduce((acc, b) => acc.extend(b), L.latLngBounds([]));
  }, [farms]);

  const overlayBounds = overlay
    ? L.latLngBounds(
        [overlay.bounds[0][1], overlay.bounds[0][0]],
        [overlay.bounds[1][1], overlay.bounds[1][0]],
      )
    : null;

  return (
    <div className={`${height} w-full overflow-hidden rounded-xl`}>
      <MapContainer
        center={[30.3753, 69.3451]}
        zoom={5}
        className="h-full w-full"
        scrollWheelZoom
      >
        <LayersControl position="topright">
          {Object.entries(basemaps).map(([key, layer]) => (
            <LayersControl.BaseLayer
              key={key}
              checked={satellite ? key === 'imagery' : key === 'streets'}
              name={layer.name}
            >
              <TileLayer attribution={layer.attribution} url={layer.url} maxZoom={layer.maxZoom} />
            </LayersControl.BaseLayer>
          ))}
        </LayersControl>
        {farms.map(
          (farm) =>
            farm.boundary && (
              <GeoJSON
                key={`${farm.id}-${farm.updatedAt}`}
                data={{
                  type: 'Feature',
                  properties: { name: farm.name },
                  geometry: farm.boundary.geometry,
                } as GeoJSON.Feature}
                style={boundaryStyle}
                onEachFeature={(_, layer) => {
                  layer.bindTooltip(farm.name, { sticky: true });
                }}
              />
            ),
        )}
        {overlayUrl && overlayBounds && (
          <ImageOverlay url={overlayUrl} bounds={overlayBounds} opacity={0.85} zIndex={400} />
        )}
        <FitBounds bounds={overlayBounds ?? bounds} />
      </MapContainer>
    </div>
  );
}
