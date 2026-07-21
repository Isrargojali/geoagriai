"""Weather retrieval via the Open-Meteo API (no API key required)."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from .config import get_settings
from .models import CurrentWeather, ForecastDay, WeatherResponse


class WeatherError(RuntimeError):
    pass


async def fetch_weather(lat: float, lng: float) -> WeatherResponse:
    settings = get_settings()
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": ",".join(
            [
                "temperature_2m",
                "relative_humidity_2m",
                "precipitation",
                "wind_speed_10m",
                "wind_direction_10m",
                "weather_code",
            ]
        ),
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "wind_speed_10m_max",
                "weather_code",
            ]
        ),
        "hourly": "relative_humidity_2m",
        "forecast_days": 7,
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(f"{settings.weather_base_url}/forecast", params=params)

    if response.status_code != 200:
        raise WeatherError(f"Open-Meteo returned HTTP {response.status_code}")

    data = response.json()
    current = data.get("current") or {}
    daily = data.get("daily") or {}
    hourly = data.get("hourly") or {}

    # Aggregate hourly humidity into a per-day mean.
    humidity_by_day: dict[str, list[float]] = {}
    for time_str, value in zip(hourly.get("time", []), hourly.get("relative_humidity_2m", [])):
        if value is None:
            continue
        humidity_by_day.setdefault(time_str[:10], []).append(float(value))

    forecast: list[ForecastDay] = []
    for i, day in enumerate(daily.get("time", [])):
        humidity_values = humidity_by_day.get(day, [])
        forecast.append(
            ForecastDay(
                date=day,
                temp_min_c=float(daily["temperature_2m_min"][i]),
                temp_max_c=float(daily["temperature_2m_max"][i]),
                rainfall_mm=float(daily["precipitation_sum"][i] or 0.0),
                humidity_pct=round(
                    sum(humidity_values) / len(humidity_values), 1
                )
                if humidity_values
                else 0.0,
                wind_speed_kmh=float(daily["wind_speed_10m_max"][i]),
                weather_code=int(daily["weather_code"][i]),
            )
        )

    return WeatherResponse(
        current=CurrentWeather(
            temperature_c=float(current.get("temperature_2m", 0.0)),
            humidity_pct=float(current.get("relative_humidity_2m", 0.0)),
            rainfall_mm=float(current.get("precipitation", 0.0)),
            wind_speed_kmh=float(current.get("wind_speed_10m", 0.0)),
            wind_direction_deg=float(current.get("wind_direction_10m", 0.0)),
            weather_code=int(current.get("weather_code", 0)),
            fetched_at=datetime.now(timezone.utc).isoformat(),
        ),
        forecast=forecast,
    )
