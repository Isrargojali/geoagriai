/**
 * AI recommendation engine.
 *
 * IMPORTANT DESIGN RULE: this engine NEVER performs scientific calculations.
 * NDVI and all vegetation statistics come from the Python GIS service; weather
 * comes from the weather provider. This layer only *interprets* those inputs
 * with transparent agronomic rules and always explains WHY each
 * recommendation was generated (the `reasons` array).
 */
import {
  classifyNdvi,
  HEALTH_STATUS,
  type NdviStatistics,
  type RecommendationDto,
  type WeatherSnapshotDto,
} from '@geoagri/shared';

export interface RecommendationInputs {
  /** Statistics computed by the GIS service for the current analysis. */
  statistics: NdviStatistics;
  /** Current weather at the farm, if available. */
  weather: WeatherSnapshotDto | null;
  /** Total rainfall (mm) forecast over the next 7 days, if available. */
  forecastRainfallMm: number | null;
  /** Mean NDVI values of previous completed analyses, most recent first. */
  historicalMeans: number[];
  cropType: string | null;
}

const DECLINE_THRESHOLD = 0.05; // NDVI drop considered a meaningful decline
const HOT_TEMP_C = 33;
const DRY_RAIN_MM = 1;
const HIGH_HUMIDITY_PCT = 80;

export function generateRecommendation(inputs: RecommendationInputs): RecommendationDto {
  const { statistics, weather, forecastRainfallMm, historicalMeans, cropType } = inputs;
  const mean = statistics.mean;
  const status = classifyNdvi(mean);

  const reasons: string[] = [];
  const actions: string[] = [];
  let severity: RecommendationDto['severity'] = 'info';

  reasons.push(
    `Average NDVI is ${mean.toFixed(2)}, which indicates ${describeStatus(status)}.`,
  );

  // ---------- Trend analysis vs. history ----------
  const previous = historicalMeans[0];
  const delta = previous !== undefined ? mean - previous : null;
  const declining = delta !== null && delta <= -DECLINE_THRESHOLD;
  const improving = delta !== null && delta >= DECLINE_THRESHOLD;

  if (declining) {
    reasons.push(
      `Vegetation health is declining: mean NDVI dropped ${Math.abs(delta).toFixed(2)} ` +
        `since the previous analysis (${previous.toFixed(2)} → ${mean.toFixed(2)}).`,
    );
  } else if (improving) {
    reasons.push(
      `Vegetation health is improving: mean NDVI rose ${delta.toFixed(2)} ` +
        `since the previous analysis.`,
    );
  }

  // ---------- Weather-driven stress attribution ----------
  const hot = weather !== null && weather.temperatureC >= HOT_TEMP_C;
  const dry =
    (weather === null || weather.rainfallMm <= DRY_RAIN_MM) &&
    (forecastRainfallMm === null || forecastRainfallMm <= 5);
  const humid = weather !== null && weather.humidityPct >= HIGH_HUMIDITY_PCT;

  if (weather) {
    if (hot && dry) {
      reasons.push(
        `Current conditions are hot (${weather.temperatureC.toFixed(0)}°C) with ` +
          `little to no rain (${weather.rainfallMm.toFixed(1)} mm recently` +
          (forecastRainfallMm !== null
            ? `, ${forecastRainfallMm.toFixed(1)} mm forecast over 7 days`
            : '') +
          '), which points to water stress as a likely cause.',
      );
    } else if (humid && status !== HEALTH_STATUS.EXCELLENT) {
      reasons.push(
        `Humidity is high (${weather.humidityPct.toFixed(0)}%), which increases ` +
          'fungal disease risk in stressed canopies.',
      );
    }
  }

  // ---------- Spatial variability ----------
  const stressedFraction = statistics.distribution.critical + statistics.distribution.poor;
  if (stressedFraction >= 0.25 && status !== HEALTH_STATUS.CRITICAL) {
    reasons.push(
      `${Math.round(stressedFraction * 100)}% of the field shows poor or critical ` +
        'vegetation, so problems are concentrated in patches rather than uniform.',
    );
    actions.push(
      'Inspect the low-NDVI (red/orange) zones on the health map first — patchy stress often means irrigation coverage gaps, drainage issues or localized pests.',
    );
  }
  if (statistics.stdDev >= 0.15) {
    reasons.push(
      `NDVI variability is high (σ = ${statistics.stdDev.toFixed(2)}), indicating uneven crop development across the field.`,
    );
  }

  // ---------- Primary recommendation ----------
  let summary: string;
  switch (status) {
    case HEALTH_STATUS.CRITICAL:
      severity = 'critical';
      summary = declining
        ? 'Crop health is critical and declining. Immediate field inspection is required.'
        : 'Crop health is critical. Immediate field inspection is required.';
      if (hot && dry) {
        actions.push('Inspect irrigation within 24–48 hours — water stress is the most likely cause given the hot, dry conditions.');
      } else {
        actions.push('Walk the field within 24–48 hours to check for irrigation failure, pest infestation or disease.');
      }
      actions.push('Verify irrigation equipment and soil moisture in the worst-affected zones.');
      break;

    case HEALTH_STATUS.POOR:
      severity = declining ? 'critical' : 'warning';
      summary = declining
        ? 'Crop health is declining. Possible cause: water stress. Inspect irrigation within 48 hours.'
        : 'Crop health is below normal and needs attention.';
      if (hot && dry) {
        actions.push('Inspect irrigation within 48 hours and consider supplemental watering — conditions are hot and dry.');
      } else {
        actions.push('Scout the field within the next few days for pests, disease or nutrient deficiency.');
      }
      if (humid) {
        actions.push('Check leaves for fungal symptoms (spots, mildew) — high humidity raises disease pressure.');
      }
      break;

    case HEALTH_STATUS.MODERATE:
      severity = declining ? 'warning' : 'info';
      summary = declining
        ? 'Vegetation is moderate but trending downward — intervene before stress becomes severe.'
        : 'Vegetation is moderate. There is room to improve canopy vigor.';
      if (dry && hot) {
        actions.push('Review the irrigation schedule — hot, dry weather will increase water demand this week.');
      }
      actions.push('Consider a nutrient check: moderate NDVI at this stage can indicate nitrogen limitation.');
      break;

    case HEALTH_STATUS.GOOD:
    case HEALTH_STATUS.EXCELLENT:
    default:
      severity = 'info';
      summary = improving
        ? 'Crop health is strong and improving. Keep up the current management.'
        : 'Crop health is good. No urgent action needed.';
      actions.push('Maintain the current irrigation and fertilization schedule.');
      if (forecastRainfallMm !== null && forecastRainfallMm > 40) {
        actions.push(
          `Heavy rain is forecast (${forecastRainfallMm.toFixed(0)} mm over 7 days) — check field drainage in advance.`,
        );
        reasons.push('The 7-day forecast shows substantial rainfall, which can cause waterlogging.');
      }
      break;
  }

  if (cropType) {
    reasons.push(`Interpretation assumes a ${cropType} crop; growth-stage context can shift NDVI expectations.`);
  }

  return { summary, severity, actions, reasons };
}

function describeStatus(status: string): string {
  switch (status) {
    case HEALTH_STATUS.EXCELLENT:
      return 'dense, vigorous vegetation';
    case HEALTH_STATUS.GOOD:
      return 'healthy vegetation';
    case HEALTH_STATUS.MODERATE:
      return 'moderate vegetation cover';
    case HEALTH_STATUS.POOR:
      return 'sparse or stressed vegetation';
    default:
      return 'severely stressed vegetation or bare soil';
  }
}
