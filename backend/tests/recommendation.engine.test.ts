import { describe, expect, it } from 'vitest';
import type { NdviStatistics, WeatherSnapshotDto } from '@geoagri/shared';
import { generateRecommendation } from '../src/modules/analyses/recommendation.engine.js';

function stats(mean: number, overrides: Partial<NdviStatistics> = {}): NdviStatistics {
  return {
    min: Math.max(-1, mean - 0.2),
    max: Math.min(1, mean + 0.2),
    mean,
    stdDev: 0.05,
    median: mean,
    distribution: { critical: 0, poor: 0.1, moderate: 0.4, good: 0.4, excellent: 0.1 },
    pixelCount: 10_000,
    ...overrides,
  };
}

function weather(overrides: Partial<WeatherSnapshotDto> = {}): WeatherSnapshotDto {
  return {
    temperatureC: 25,
    humidityPct: 50,
    rainfallMm: 5,
    windSpeedKmh: 10,
    windDirectionDeg: 180,
    weatherCode: 1,
    description: 'Mainly clear',
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('recommendation engine (AI interpretation layer)', () => {
  it('flags water stress for low NDVI in hot, dry conditions', () => {
    const rec = generateRecommendation({
      statistics: stats(0.32),
      weather: weather({ temperatureC: 35, rainfallMm: 0 }),
      forecastRainfallMm: 0,
      historicalMeans: [0.45],
      cropType: 'wheat',
    });

    expect(rec.severity).toBe('critical');
    expect(rec.summary.toLowerCase()).toContain('declining');
    expect(rec.actions.join(' ').toLowerCase()).toContain('irrigation');
    // Explainability: reasons must mention NDVI, the decline, and the weather.
    expect(rec.reasons.length).toBeGreaterThanOrEqual(3);
    expect(rec.reasons.join(' ')).toContain('0.32');
    expect(rec.reasons.join(' ').toLowerCase()).toContain('water stress');
  });

  it('reports healthy crops as info with maintenance advice', () => {
    const rec = generateRecommendation({
      statistics: stats(0.72, {
        distribution: { critical: 0, poor: 0, moderate: 0.1, good: 0.4, excellent: 0.5 },
      }),
      weather: weather(),
      forecastRainfallMm: 10,
      historicalMeans: [0.7],
      cropType: null,
    });

    expect(rec.severity).toBe('info');
    expect(rec.summary.toLowerCase()).toContain('good');
    expect(rec.reasons.length).toBeGreaterThan(0);
  });

  it('detects improvement vs history', () => {
    const rec = generateRecommendation({
      statistics: stats(0.68),
      weather: null,
      forecastRainfallMm: null,
      historicalMeans: [0.5],
      cropType: null,
    });
    expect(rec.reasons.join(' ').toLowerCase()).toContain('improving');
  });

  it('surfaces patchy stress when poor/critical fractions are high', () => {
    const rec = generateRecommendation({
      statistics: stats(0.5, {
        distribution: { critical: 0.15, poor: 0.2, moderate: 0.3, good: 0.25, excellent: 0.1 },
      }),
      weather: weather(),
      forecastRainfallMm: 5,
      historicalMeans: [],
      cropType: null,
    });
    expect(rec.reasons.join(' ')).toMatch(/35% of the field/);
  });

  it('warns about disease risk in humid conditions for stressed crops', () => {
    const rec = generateRecommendation({
      statistics: stats(0.35),
      weather: weather({ humidityPct: 88, temperatureC: 28 }),
      forecastRainfallMm: 20,
      historicalMeans: [],
      cropType: null,
    });
    expect(rec.reasons.join(' ').toLowerCase()).toContain('humidity');
  });
});
