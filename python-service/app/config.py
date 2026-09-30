"""Service configuration loaded from environment variables (.env supported)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load the monorepo root .env when running locally, then any local .env.
_here = Path(__file__).resolve()
for candidate in (_here.parents[2] / ".env", _here.parents[1] / ".env"):
    if candidate.exists():
        load_dotenv(candidate)
        break


class Settings:
    """Plain settings object (env-driven, no magic)."""

    def __init__(self) -> None:
        self.port: int = int(os.getenv("PYTHON_SERVICE_PORT", "8000"))
        self.api_key: str = os.getenv("GIS_SERVICE_API_KEY", "dev-internal-key")
        self.gee_service_account: str = os.getenv("GEE_SERVICE_ACCOUNT_EMAIL", "")
        self.gee_key_file: str = os.getenv("GEE_PRIVATE_KEY_FILE", "")
        self.weather_base_url: str = os.getenv(
            "WEATHER_API_BASE_URL", "https://api.open-meteo.com/v1"
        )
        # Max cloudy-pixel percentage accepted for a Sentinel-2 scene.
        self.max_cloud_pct: float = float(os.getenv("MAX_CLOUD_PCT", "40"))
        # Minimum cloud-free fraction inside the submitted farm boundary when
        # ranking Sentinel-2 scenes. Lower this only for persistently cloudy
        # regions/seasons.
        self.min_farm_clear_ratio: float = float(
            os.getenv("MIN_FARM_CLEAR_RATIO", "0.55")
        )
        # Max PNG side length for GEE NDVI thumbnails. Sentinel-2 red/NIR bands
        # are 10 m, so this mostly prevents unnecessary blur on larger farms.
        self.ndvi_thumb_max_dimension: int = int(
            os.getenv("NDVI_THUMB_MAX_DIMENSION", "2048")
        )

    @property
    def gee_enabled(self) -> bool:
        return bool(
            self.gee_service_account
            and self.gee_key_file
            and Path(self.gee_key_file).exists()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
