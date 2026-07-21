import {
  describeWeatherCode,
  type ForecastDayDto,
  type WeatherDto,
} from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { toJson } from '../../lib/json.js';
import { NotFoundError } from '../../lib/errors.js';
import { requestWeather } from '../analyses/gis.client.js';

const CACHE_MINUTES = 30;

/**
 * Get current weather + 7-day forecast for a farm. Responses are cached in
 * the WeatherRecord table for CACHE_MINUTES to limit upstream calls.
 */
export async function getFarmWeather(userId: string, farmId: string): Promise<WeatherDto> {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw new NotFoundError('Farm');

  const cutoff = new Date(Date.now() - CACHE_MINUTES * 60_000);
  const cached = await prisma.weatherRecord.findFirst({
    where: { farmId, createdAt: { gte: cutoff }, forecastJson: { not: null } },
    orderBy: { createdAt: 'desc' },
  });

  if (cached?.forecastJson) {
    return {
      current: {
        temperatureC: cached.temperatureC,
        humidityPct: cached.humidityPct,
        rainfallMm: cached.rainfallMm,
        windSpeedKmh: cached.windSpeedKmh,
        windDirectionDeg: cached.windDirectionDeg,
        weatherCode: cached.weatherCode,
        description: describeWeatherCode(cached.weatherCode),
        fetchedAt: cached.createdAt.toISOString(),
      },
      forecast: JSON.parse(cached.forecastJson) as ForecastDayDto[],
    };
  }

  const weather = await requestWeather(farm.centroidLat, farm.centroidLng);
  const forecast: ForecastDayDto[] = weather.forecast.map((d) => ({
    date: d.date,
    tempMinC: d.temp_min_c,
    tempMaxC: d.temp_max_c,
    rainfallMm: d.rainfall_mm,
    humidityPct: d.humidity_pct,
    windSpeedKmh: d.wind_speed_kmh,
    weatherCode: d.weather_code,
    description: describeWeatherCode(d.weather_code),
  }));

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
      forecastJson: toJson(forecast),
    },
  });

  return {
    current: {
      temperatureC: record.temperatureC,
      humidityPct: record.humidityPct,
      rainfallMm: record.rainfallMm,
      windSpeedKmh: record.windSpeedKmh,
      windDirectionDeg: record.windDirectionDeg,
      weatherCode: record.weatherCode,
      description: describeWeatherCode(record.weatherCode),
      fetchedAt: record.createdAt.toISOString(),
    },
    forecast,
  };
}
