import { describe, expect, it } from 'vitest';
import {
  analyzeGeometry,
  geometryFromGeoJsonUpload,
  geometryFromKmlUpload,
} from '../src/modules/farms/geometry.service.js';
import { BadRequestError } from '../src/lib/errors.js';
import { squareFarmGeometry } from './helpers.js';

describe('geometry service', () => {
  it('computes area, centroid and bounds for a polygon', () => {
    const info = analyzeGeometry(squareFarmGeometry);
    // ~1.11km x ~0.95km cell at this latitude ≈ 105 ha
    expect(info.areaHectares).toBeGreaterThan(90);
    expect(info.areaHectares).toBeLessThan(120);
    expect(info.centroidLat).toBeCloseTo(31.405, 2);
    expect(info.centroidLng).toBeCloseTo(73.055, 2);
    expect(info.bounds).toEqual([
      [73.05, 31.4],
      [73.06, 31.41],
    ]);
  });

  it('closes unclosed rings automatically', () => {
    const open = {
      type: 'Polygon',
      coordinates: [
        [
          [73.05, 31.4],
          [73.06, 31.4],
          [73.06, 31.41],
          [73.05, 31.41],
        ],
      ],
    };
    const info = analyzeGeometry(open);
    expect(info.areaHectares).toBeGreaterThan(90);
  });

  it('rejects invalid geometry', () => {
    expect(() => analyzeGeometry({ type: 'Point', coordinates: [0, 0] })).toThrow(BadRequestError);
    expect(() => analyzeGeometry(null)).toThrow(BadRequestError);
  });

  it('rejects farms above the size limit', () => {
    const huge = {
      type: 'Polygon',
      coordinates: [
        [
          [70, 30],
          [74, 30],
          [74, 34],
          [70, 34],
          [70, 30],
        ],
      ],
    };
    expect(() => analyzeGeometry(huge)).toThrow(/too large/);
  });

  it('extracts geometry from a GeoJSON FeatureCollection with altitude values', () => {
    const doc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'field' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [73.05, 31.4, 120],
                [73.06, 31.4, 121],
                [73.06, 31.41, 119],
                [73.05, 31.41, 122],
                [73.05, 31.4, 120],
              ],
            ],
          },
        },
      ],
    });
    const geometry = geometryFromGeoJsonUpload(doc);
    expect(geometry.type).toBe('Polygon');
    // Altitude must be stripped.
    expect((geometry.coordinates as number[][][])[0][0]).toHaveLength(2);
  });

  it('rejects GeoJSON without polygons', () => {
    expect(() =>
      geometryFromGeoJsonUpload(JSON.stringify({ type: 'Point', coordinates: [1, 2] })),
    ).toThrow(/No Polygon/);
    expect(() => geometryFromGeoJsonUpload('not json at all')).toThrow(/not valid JSON/);
  });

  it('parses a KML polygon', () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><Placemark><name>Farm</name>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>
      73.05,31.40,0 73.06,31.40,0 73.06,31.41,0 73.05,31.41,0 73.05,31.40,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark></Document>
</kml>`;
    const geometry = geometryFromKmlUpload(kml);
    expect(geometry.type).toBe('Polygon');
    const info = analyzeGeometry(geometry);
    expect(info.areaHectares).toBeGreaterThan(90);
  });
});
