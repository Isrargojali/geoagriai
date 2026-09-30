import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AUDIT_ACTIONS,
  classifyNdvi,
  describeWeatherCode,
  ndviToHealthScore,
  NOTIFICATION_TYPES,
  type AnalysisDto,
  type FarmGeometry,
  type NdviStatistics,
  type RecommendationDto,
  type WeatherSnapshotDto,
} from '@geoagri/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { fromJson, toJson } from '../../lib/json.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import { assertCanRunAnalysis } from '../subscriptions/usage.service.js';
import { createNotification } from '../notifications/notification.service.js';
import { requestNdviAnalysis, requestWeather } from './gis.client.js';
import { generateRecommendation } from './recommendation.engine.js';

type AnalysisRecord = NonNullable<Awaited<ReturnType<typeof prisma.analysis.findFirst>>>;

export function toAnalysisDto(a: AnalysisRecord): AnalysisDto {
  return {
    id: a.id,
    farmId: a.farmId,
    type: a.type as AnalysisDto['type'],
    status: a.status as AnalysisDto['status'],
    imageDate: a.imageDate?.toISOString() ?? null,
    cloudCover: a.cloudCover,
    ndviMean: a.ndviMean,
    healthScore: a.healthScore,
    healthStatus: a.healthStatus as AnalysisDto['healthStatus'],
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    statistics: fromJson<NdviStatistics>(a.statisticsJson),
    recommendation: fromJson<RecommendationDto>(a.recommendationJson),
    ndviImageUrl: a.ndviImagePath ? `/api/v1/files/ndvi/${path.basename(a.ndviImagePath)}` : null,
    imageBounds: fromJson<[[number, number], [number, number]]>(a.imageBoundsJson),
    weather: null,
    error: a.error,
    ndviChange: null,
  };
}

async function attachContext(dto: AnalysisDto, record: AnalysisRecord): Promise<AnalysisDto> {
  // Weather snapshot from the linked weather record.
  if (record.weatherRecordId) {
    const weather = await prisma.weatherRecord.findUnique({
      where: { id: record.weatherRecordId },
    });
    if (weather) {
      dto.weather = {
        temperatureC: weather.temperatureC,
        humidityPct: weather.humidityPct,
        rainfallMm: weather.rainfallMm,
        windSpeedKmh: weather.windSpeedKmh,
        windDirectionDeg: weather.windDirectionDeg,
        weatherCode: weather.weatherCode,
        description: describeWeatherCode(weather.weatherCode),
        fetchedAt: weather.createdAt.toISOString(),
      };
    }
  }

  // Historical comparison vs. the previous completed analysis.
  if (record.ndviMean != null) {
    const previous = await prisma.analysis.findFirst({
      where: {
        farmId: record.farmId,
        status: 'COMPLETED',
        createdAt: { lt: record.createdAt },
        ndviMean: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { ndviMean: true },
    });
    if (previous?.ndviMean != null) {
      dto.ndviChange = Number((record.ndviMean - previous.ndviMean).toFixed(4));
    }
  }

  return dto;
}

/**
 * Run a full analysis synchronously:
 * geometry → GIS service (Sentinel-2 NDVI) → weather → AI interpretation →
 * persisted analysis. Runtime is typically a few seconds (synthetic) up to
 * ~1-2 minutes (GEE), so the endpoint uses a generous timeout client-side.
 */
export async function runAnalysis(
  userId: string,
  farmId: string,
  options: { endDate?: string; windowDays: number },
  ipAddress?: string,
  role?: string,
): Promise<AnalysisDto> {
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId },
    include: { boundary: true },
  });
  if (!farm) throw new NotFoundError('Farm');
  if (!farm.boundary) {
    throw new AppError(400, 'NO_BOUNDARY', 'This farm has no boundary geometry');
  }

  await assertCanRunAnalysis(userId, role);

  const analysis = await prisma.analysis.create({
    data: { farmId, userId, type: 'NDVI', status: 'PROCESSING' },
  });
  await audit({
    userId,
    action: AUDIT_ACTIONS.ANALYSIS_REQUESTED,
    resource: 'analysis',
    resourceId: analysis.id,
    details: { farmId, ...options },
    ipAddress,
  });

  try {
    const geometry = fromJson<FarmGeometry>(farm.boundary.geometryJson);
    if (!geometry) throw new AppError(500, 'BAD_GEOMETRY', 'Stored farm geometry is corrupt');

    // 1) Scientific computation — delegated entirely to the GIS service.
    const gis = await requestNdviAnalysis({
      geometry,
      endDate: options.endDate,
      windowDays: options.windowDays,
    });

    // 2) Weather context (non-fatal if unavailable).
    let weatherRecordId: string | null = null;
    let weatherSnapshot: WeatherSnapshotDto | null = null;
    let forecastRainfallMm: number | null = null;
    try {
      const weather = await requestWeather(farm.centroidLat, farm.centroidLng);
      forecastRainfallMm = weather.forecast.reduce((sum, d) => sum + d.rainfall_mm, 0);
      const record = await prisma.weatherRecord.create({
        data: {
          farmId,
          date: new Date(),
          temperatureC: weather.current.temperature_c,
          humidityPct: weather.current.humidity_pct,
          rainfallMm: weather.current.rainfall_mm,
          windSpeedKmh: weather.current.wind_speed_kmh,
          windDirectionDeg: weather.current.wind_direction_deg,
          weatherCode: weather.current.weather_code,
          forecastJson: toJson(
            weather.forecast.map((d) => ({
              date: d.date,
              tempMinC: d.temp_min_c,
              tempMaxC: d.temp_max_c,
              rainfallMm: d.rainfall_mm,
              humidityPct: d.humidity_pct,
              windSpeedKmh: d.wind_speed_kmh,
              weatherCode: d.weather_code,
              description: describeWeatherCode(d.weather_code),
            })),
          ),
        },
      });
      weatherRecordId = record.id;
      weatherSnapshot = {
        temperatureC: weather.current.temperature_c,
        humidityPct: weather.current.humidity_pct,
        rainfallMm: weather.current.rainfall_mm,
        windSpeedKmh: weather.current.wind_speed_kmh,
        windDirectionDeg: weather.current.wind_direction_deg,
        weatherCode: weather.current.weather_code,
        description: describeWeatherCode(weather.current.weather_code),
        fetchedAt: weather.current.fetched_at,
      };
    } catch (weatherErr) {
      console.warn('[analysis] weather fetch failed, continuing without it', weatherErr);
    }

    // 3) Historical NDVI for trend interpretation.
    const history = await prisma.analysis.findMany({
      where: { farmId, status: 'COMPLETED', ndviMean: { not: null }, id: { not: analysis.id } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { ndviMean: true },
    });

    const statistics: NdviStatistics = {
      min: gis.statistics.min,
      max: gis.statistics.max,
      mean: gis.statistics.mean,
      stdDev: gis.statistics.std_dev,
      median: gis.statistics.median,
      distribution: gis.statistics.distribution,
      pixelCount: gis.statistics.pixel_count,
    };

    // 4) AI interpretation (no scientific math — rules over GIS/weather inputs).
    const recommendation = generateRecommendation({
      statistics,
      weather: weatherSnapshot,
      forecastRainfallMm,
      historicalMeans: history.map((h) => h.ndviMean as number),
      cropType: farm.cropType,
    });

    // 5) Persist the NDVI overlay image.
    const fileName = `${analysis.id}-${randomUUID().slice(0, 8)}.png`;
    const filePath = path.join(env.ndviDir, fileName);
    await writeFile(filePath, Buffer.from(gis.png_base64, 'base64'));

    const healthScore = ndviToHealthScore(statistics.mean);
    const healthStatus = classifyNdvi(statistics.mean);

    const completed = await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: 'COMPLETED',
        imageDate: new Date(gis.image_date),
        cloudCover: gis.cloud_cover,
        ndviMin: statistics.min,
        ndviMax: statistics.max,
        ndviMean: statistics.mean,
        ndviStdDev: statistics.stdDev,
        healthScore,
        healthStatus,
        statisticsJson: toJson(statistics),
        recommendationJson: toJson(recommendation),
        ndviImagePath: filePath,
        imageBoundsJson: toJson(gis.bounds),
        weatherRecordId,
        completedAt: new Date(),
      },
    });

    await audit({
      userId,
      action: AUDIT_ACTIONS.ANALYSIS_COMPLETED,
      resource: 'analysis',
      resourceId: analysis.id,
      details: { provider: gis.provider, ndviMean: statistics.mean, healthScore },
    });
    await createNotification(userId, {
      title: 'Analysis completed',
      message: `NDVI analysis for "${farm.name}" finished — health score ${healthScore}/100 (${healthStatus.toLowerCase()}).`,
      type: NOTIFICATION_TYPES.ANALYSIS_COMPLETED,
    });

    return attachContext(toAnalysisDto(completed), completed);
  } catch (err) {
    const message =
      err instanceof AppError ? err.message : 'Analysis failed due to an internal error';
    const failed = await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: 'FAILED', error: message, completedAt: new Date() },
    });
    await audit({
      userId,
      action: AUDIT_ACTIONS.ANALYSIS_FAILED,
      resource: 'analysis',
      resourceId: analysis.id,
      details: { error: message },
    });
    await createNotification(userId, {
      title: 'Analysis failed',
      message: `NDVI analysis for "${farm.name}" failed: ${message}`,
      type: NOTIFICATION_TYPES.ANALYSIS_FAILED,
    });
    if (err instanceof AppError) throw err;
    console.error('[analysis] unexpected failure', err);
    return attachContext(toAnalysisDto(failed), failed);
  }
}

export async function listAnalyses(
  userId: string,
  farmId: string,
  page: number,
  pageSize: number,
) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw new NotFoundError('Farm');

  const [total, items] = await Promise.all([
    prisma.analysis.count({ where: { farmId } }),
    prisma.analysis.findMany({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: items.map(toAnalysisDto),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAnalysis(userId: string, analysisId: string): Promise<AnalysisDto> {
  const record = await prisma.analysis.findFirst({
    where: { id: analysisId, userId },
  });
  if (!record) throw new NotFoundError('Analysis');
  return attachContext(toAnalysisDto(record), record);
}

/** Time series of completed analyses for charts (oldest → newest). */
export async function getAnalysisHistory(userId: string, farmId: string) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw new NotFoundError('Farm');

  const items = await prisma.analysis.findMany({
    where: { farmId, status: 'COMPLETED', ndviMean: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      imageDate: true,
      createdAt: true,
      ndviMean: true,
      ndviMin: true,
      ndviMax: true,
      healthScore: true,
      healthStatus: true,
    },
  });

  return items.map((a) => ({
    id: a.id,
    date: (a.imageDate ?? a.createdAt).toISOString(),
    ndviMean: a.ndviMean as number,
    ndviMin: a.ndviMin,
    ndviMax: a.ndviMax,
    healthScore: a.healthScore,
    healthStatus: a.healthStatus,
  }));
}
