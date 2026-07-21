"""Pydantic request/response models — the contract with the Node backend."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class GeoJsonGeometry(BaseModel):
    type: Literal["Polygon", "MultiPolygon"]
    coordinates: list

    @field_validator("coordinates")
    @classmethod
    def non_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("coordinates must not be empty")
        return v


class NdviRequest(BaseModel):
    geometry: GeoJsonGeometry
    end_date: Optional[str] = Field(
        default=None, description="Target date YYYY-MM-DD (defaults to today)"
    )
    window_days: int = Field(default=30, ge=5, le=120)
    max_cloud_pct: Optional[float] = Field(default=None, ge=0, le=100)


class NdviDistribution(BaseModel):
    critical: float
    poor: float
    moderate: float
    good: float
    excellent: float


class NdviStatistics(BaseModel):
    min: float
    max: float
    mean: float
    std_dev: float
    median: float
    distribution: NdviDistribution
    pixel_count: int


class NdviResponse(BaseModel):
    provider: Literal["gee", "synthetic"]
    image_date: str
    cloud_cover: float
    statistics: NdviStatistics
    png_base64: str
    bounds: list[list[float]] = Field(
        description="[[minLng, minLat], [maxLng, maxLat]]"
    )


class CurrentWeather(BaseModel):
    temperature_c: float
    humidity_pct: float
    rainfall_mm: float
    wind_speed_kmh: float
    wind_direction_deg: float
    weather_code: int
    fetched_at: str


class ForecastDay(BaseModel):
    date: str
    temp_min_c: float
    temp_max_c: float
    rainfall_mm: float
    humidity_pct: float
    wind_speed_kmh: float
    weather_code: int


class WeatherResponse(BaseModel):
    current: CurrentWeather
    forecast: list[ForecastDay]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    gee_enabled: bool
    version: str
