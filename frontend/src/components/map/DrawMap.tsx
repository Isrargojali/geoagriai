import { useEffect, useRef } from 'react';
import { LayersControl, MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import type { FarmGeometry } from '@geoagri/shared';
import { basemaps, geometryBounds } from './FarmMap';
import { LocationSearch } from './LocationSearch';

// leaflet-draw expects marker icons from the leaflet package; polygons only
// are enabled here so default icon wiring is unnecessary.

function DrawControl({
  initialGeometry,
  onChange,
}: {
  initialGeometry: FarmGeometry | null;
  onChange: (geometry: FarmGeometry | null) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    const group = new L.FeatureGroup();
    groupRef.current = group;
    map.addLayer(group);

    if (initialGeometry) {
      const layer = L.geoJSON({
        type: 'Feature',
        properties: {},
        geometry: initialGeometry,
      } as GeoJSON.Feature);
      layer.eachLayer((l) => group.addLayer(l));
      const bounds = geometryBounds(initialGeometry);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    }

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: '#16a34a', weight: 2.5 },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: group, remove: true },
    });
    map.addControl(drawControl);

    const emit = () => {
      const layers = group.getLayers();
      if (layers.length === 0) {
        onChange(null);
        return;
      }
      const polygons: number[][][][] = [];
      for (const layer of layers) {
        const geo = (layer as L.Polygon).toGeoJSON().geometry;
        if (geo.type === 'Polygon') polygons.push(geo.coordinates as number[][][]);
        else if (geo.type === 'MultiPolygon') polygons.push(...(geo.coordinates as number[][][][]));
      }
      onChange(
        polygons.length === 1
          ? { type: 'Polygon', coordinates: polygons[0] }
          : { type: 'MultiPolygon', coordinates: polygons },
      );
    };

    const onCreated = (event: L.LeafletEvent) => {
      // MVP scope: one boundary per farm — replace any previous drawing.
      group.clearLayers();
      group.addLayer((event as L.DrawEvents.Created).layer);
      emit();
    };

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, emit);
    map.on(L.Draw.Event.DELETED, emit);

    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.EDITED, emit);
      map.off(L.Draw.Event.DELETED, emit);
      map.removeControl(drawControl);
      map.removeLayer(group);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps — mount once per map
  }, [map]);

  return null;
}

/** Interactive polygon drawing map for farm boundary creation/editing. */
export function DrawMap({
  initialGeometry = null,
  onChange,
  height = 'h-[28rem]',
}: {
  initialGeometry?: FarmGeometry | null;
  onChange: (geometry: FarmGeometry | null) => void;
  height?: string;
}) {
  return (
    <div className={`${height} w-full overflow-hidden rounded-xl`}>
      <MapContainer
        center={[30.3753, 69.3451]}
        zoom={5}
        className="h-full w-full"
        scrollWheelZoom
        zoomControl={false}
      >
        <LayersControl position="bottomleft">
          {Object.entries(basemaps).map(([key, layer]) => (
            <LayersControl.BaseLayer key={key} checked={key === 'imagery'} name={layer.name}>
              <TileLayer attribution={layer.attribution} url={layer.url} maxZoom={layer.maxZoom} />
            </LayersControl.BaseLayer>
          ))}
        </LayersControl>
        <ZoomControl position="bottomright" />
        <LocationSearch />
        <DrawControl initialGeometry={initialGeometry} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
