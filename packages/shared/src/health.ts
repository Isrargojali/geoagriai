/** Crop-health interpretation helpers (display logic only — NDVI itself is
 *  always computed by the Python GIS service, never here). */

import { HEALTH_STATUS, NDVI_HEALTH_THRESHOLDS, type HealthStatus } from './constants.js';

/** Classify a mean NDVI value into a health status band. */
export function classifyNdvi(meanNdvi: number): HealthStatus {
  for (const { min, status } of NDVI_HEALTH_THRESHOLDS) {
    if (meanNdvi >= min) return status;
  }
  return HEALTH_STATUS.CRITICAL;
}

/**
 * Convert a mean NDVI (-1..1) to a 0-100 health score.
 * NDVI below 0 (water/bare soil) maps to 0; 0.85+ maps to 100.
 */
export function ndviToHealthScore(meanNdvi: number): number {
  const clamped = Math.max(0, Math.min(0.85, meanNdvi));
  return Math.round((clamped / 0.85) * 100);
}

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  [HEALTH_STATUS.EXCELLENT]: 'Excellent',
  [HEALTH_STATUS.GOOD]: 'Good',
  [HEALTH_STATUS.MODERATE]: 'Moderate',
  [HEALTH_STATUS.POOR]: 'Poor',
  [HEALTH_STATUS.CRITICAL]: 'Critical',
};

export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  [HEALTH_STATUS.EXCELLENT]: '#15803d',
  [HEALTH_STATUS.GOOD]: '#65a30d',
  [HEALTH_STATUS.MODERATE]: '#ca8a04',
  [HEALTH_STATUS.POOR]: '#ea580c',
  [HEALTH_STATUS.CRITICAL]: '#dc2626',
};

/** Human-readable description for WMO weather interpretation codes (Open-Meteo). */
export function describeWeatherCode(code: number): string {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] ?? 'Unknown';
}
