import area from '@turf/area';
import centroid from '@turf/centroid';
import bbox from '@turf/bbox';
import { DOMParser } from '@xmldom/xmldom';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import {
  farmGeometrySchema,
  MAX_FARM_AREA_HA,
  MIN_FARM_AREA_HA,
  type FarmGeometry,
} from '@geoagri/shared';
import { BadRequestError } from '../../lib/errors.js';

export interface GeometryInfo {
  geometry: FarmGeometry;
  areaHectares: number;
  centroidLat: number;
  centroidLng: number;
  /** [[minLng,minLat],[maxLng,maxLat]] */
  bounds: [[number, number], [number, number]];
}

/**
 * Validate a farm geometry and derive area (ha), centroid and bounds.
 * Area uses turf's geodesic computation (equivalent to PostGIS
 * ST_Area(geography) — swapping to PostGIS later only changes this module).
 */
export function analyzeGeometry(geometry: unknown): GeometryInfo {
  const parsed = farmGeometrySchema.safeParse(geometry);
  if (!parsed.success) {
    throw new BadRequestError('Invalid farm geometry', parsed.error.flatten());
  }
  const geom = parsed.data as FarmGeometry;

  // Ensure rings are closed (first position === last position).
  const rings =
    geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
  }

  const feature = { type: 'Feature' as const, properties: {}, geometry: geom };
  const areaM2 = area(feature);
  const areaHectares = areaM2 / 10_000;

  if (!Number.isFinite(areaHectares) || areaHectares < MIN_FARM_AREA_HA) {
    throw new BadRequestError(
      `Farm area is too small (${areaHectares.toFixed(4)} ha). Minimum is ${MIN_FARM_AREA_HA} ha.`,
    );
  }
  if (areaHectares > MAX_FARM_AREA_HA) {
    throw new BadRequestError(
      `Farm area is too large (${Math.round(areaHectares)} ha). Maximum is ${MAX_FARM_AREA_HA} ha.`,
    );
  }

  const center = centroid(feature);
  const [minLng, minLat, maxLng, maxLat] = bbox(feature);

  return {
    geometry: geom,
    areaHectares: Number(areaHectares.toFixed(4)),
    centroidLat: Number(center.geometry.coordinates[1].toFixed(6)),
    centroidLng: Number(center.geometry.coordinates[0].toFixed(6)),
    bounds: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
  };
}

/** Extract the first Polygon/MultiPolygon from an uploaded GeoJSON document. */
export function geometryFromGeoJsonUpload(content: string): FarmGeometry {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    throw new BadRequestError('File is not valid JSON');
  }

  const candidates = collectGeometries(doc);
  if (candidates.length === 0) {
    throw new BadRequestError('No Polygon or MultiPolygon geometry found in the GeoJSON file');
  }
  return mergeCandidates(candidates);
}

/** Extract the first Polygon/MultiPolygon from an uploaded KML document. */
export function geometryFromKmlUpload(content: string): FarmGeometry {
  let converted: unknown;
  try {
    const dom = new DOMParser({
      errorHandler: {
        // xmldom is noisy on well-formed-but-unusual KML; fail only on fatal.
        warning: () => undefined,
        error: () => undefined,
        fatalError: (msg) => {
          throw new Error(String(msg));
        },
      },
    }).parseFromString(content, 'text/xml');
    converted = kmlToGeoJson(dom as unknown as Document);
  } catch {
    throw new BadRequestError('File is not valid KML');
  }

  const candidates = collectGeometries(converted);
  if (candidates.length === 0) {
    throw new BadRequestError('No Polygon or MultiPolygon geometry found in the KML file');
  }
  return mergeCandidates(candidates);
}

// ---------- helpers ----------

interface AnyObject {
  [key: string]: unknown;
}

function isObject(v: unknown): v is AnyObject {
  return typeof v === 'object' && v !== null;
}

/** Recursively collect Polygon/MultiPolygon geometries from any GeoJSON shape
 *  (Geometry, Feature, FeatureCollection, GeometryCollection). Strips altitude
 *  (3rd coordinate) since the platform works in 2D. */
function collectGeometries(doc: unknown): FarmGeometry[] {
  const found: FarmGeometry[] = [];

  function visit(node: unknown): void {
    if (!isObject(node)) return;
    const type = node.type;
    if (type === 'Polygon' || type === 'MultiPolygon') {
      const parsed = farmGeometrySchema.safeParse({
        type,
        coordinates: strip3d(node.coordinates),
      });
      if (parsed.success) found.push(parsed.data as FarmGeometry);
      return;
    }
    if (type === 'Feature') visit(node.geometry);
    if (type === 'FeatureCollection' && Array.isArray(node.features)) {
      node.features.forEach(visit);
    }
    if (type === 'GeometryCollection' && Array.isArray(node.geometries)) {
      node.geometries.forEach(visit);
    }
  }

  visit(doc);
  return found;
}

function strip3d(coords: unknown): unknown {
  if (!Array.isArray(coords)) return coords;
  if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return [coords[0], coords[1]];
  }
  return coords.map(strip3d);
}

/** Combine one-or-more polygons into a single geometry (MultiPolygon if >1). */
function mergeCandidates(candidates: FarmGeometry[]): FarmGeometry {
  if (candidates.length === 1) return candidates[0];
  const polygons: number[][][][] = [];
  for (const geom of candidates) {
    if (geom.type === 'Polygon') polygons.push(geom.coordinates);
    else polygons.push(...geom.coordinates);
  }
  return { type: 'MultiPolygon', coordinates: polygons };
}
