"""GeoAgri AI — GIS & Remote Sensing service (FastAPI)."""
from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from .config import get_settings
from .gee import GeeUnavailableError, analyze_gee
from .models import HealthResponse, NdviRequest, NdviResponse, WeatherResponse
from .synthetic import analyze_synthetic
from .weather import WeatherError, fetch_weather

VERSION = "1.0.0"

logger = logging.getLogger("geoagri.gis")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="GeoAgri AI — GIS Service",
    description=(
        "Internal GIS & Remote Sensing service. Retrieves Sentinel-2 imagery "
        "via Google Earth Engine, computes NDVI, and provides weather data. "
        "All scientific calculations happen here — the AI layer only "
        "interprets the results."
    ),
    version=VERSION,
)


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok", gee_enabled=get_settings().gee_enabled, version=VERSION
    )


@app.post(
    "/analyze/ndvi",
    response_model=NdviResponse,
    dependencies=[Depends(require_api_key)],
    summary="Compute NDVI for a farm boundary",
)
async def analyze_ndvi(request: NdviRequest) -> NdviResponse:
    """
    Retrieve the least-cloudy Sentinel-2 scene in the requested window,
    mask clouds, clip to the farm boundary, and return NDVI statistics plus a
    colour-mapped overlay PNG.

    Falls back to the deterministic synthetic provider when Google Earth
    Engine is not configured, so the platform remains fully functional in
    development environments.
    """
    settings = get_settings()

    if settings.gee_enabled:
        try:
            return analyze_gee(
                request.geometry,
                request.end_date,
                request.window_days,
                request.max_cloud_pct,
            )
        except GeeUnavailableError as exc:
            # A configured GEE with no valid imagery is a real "no data" case —
            # surface it rather than silently switching providers.
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001 — report upstream failures cleanly
            logger.exception("GEE analysis failed")
            raise HTTPException(
                status_code=502, detail=f"Earth Engine analysis failed: {exc}"
            ) from exc

    try:
        return analyze_synthetic(request.geometry, request.end_date, request.window_days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get(
    "/weather",
    response_model=WeatherResponse,
    dependencies=[Depends(require_api_key)],
    summary="Current weather + 7-day forecast for a location",
)
async def weather(lat: float, lng: float) -> WeatherResponse:
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    try:
        return await fetch_weather(lat, lng)
    except WeatherError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.exception_handler(Exception)
async def unhandled_exception_handler(_, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
