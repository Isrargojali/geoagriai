import { describe, expect, it } from 'vitest';
import { formatArea, formatNdvi, formatUsd } from '@/lib/format';
import { classifyNdvi, describeWeatherCode, ndviToHealthScore } from '@geoagri/shared';

describe('format helpers', () => {
  it('formats areas in hectares', () => {
    expect(formatArea(105.5304)).toContain('105.53');
    expect(formatArea(105.5304)).toContain('ha');
  });

  it('formats USD amounts and contact-sales plans', () => {
    expect(formatUsd(9.99)).toBe('$9.99');
    expect(formatUsd(null)).toBe('Contact sales');
  });

  it('formats NDVI values with placeholders', () => {
    expect(formatNdvi(0.4818)).toBe('0.48');
    expect(formatNdvi(null)).toBe('—');
  });
});

describe('shared crop-health interpretation', () => {
  it('classifies NDVI into health bands', () => {
    expect(classifyNdvi(0.8)).toBe('EXCELLENT');
    expect(classifyNdvi(0.6)).toBe('GOOD');
    expect(classifyNdvi(0.45)).toBe('MODERATE');
    expect(classifyNdvi(0.3)).toBe('POOR');
    expect(classifyNdvi(0.1)).toBe('CRITICAL');
  });

  it('maps NDVI to a 0-100 health score', () => {
    expect(ndviToHealthScore(0)).toBe(0);
    expect(ndviToHealthScore(0.85)).toBe(100);
    expect(ndviToHealthScore(-0.5)).toBe(0);
    expect(ndviToHealthScore(0.425)).toBe(50);
  });

  it('describes WMO weather codes', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(95)).toContain('Thunderstorm');
    expect(describeWeatherCode(12345)).toBe('Unknown');
  });
});
