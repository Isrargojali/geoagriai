"""
Synthetic NDVI provider — used when Google Earth Engine credentials are not
configured (local development, demos, CI). Produces a deterministic,
agronomically plausible NDVI field for the farm geometry so the full product
workflow (analysis → AI recommendation → report) works end to end.
"""
from __future__ import annotations

import hashlib
from datetime import date, timedelta

import numpy as np
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from shapely.geometry import shape

from .models import GeoJsonGeometry, NdviResponse
from .ndvi_render import render_ndvi_png
from .stats import compute_statistics

MAX_GRID = 160  # max raster dimension in pixels


def _geometry_seed(geometry: GeoJsonGeometry, day: date) -> int:
    """Stable seed per (farm geometry, month) so repeated runs are consistent
    but the field evolves over the season."""
    digest = hashlib.sha256(
        f"{geometry.model_dump_json()}|{day.year}-{day.month}".encode()
    ).digest()
    return int.from_bytes(digest[:8], "big")


def _seasonal_base(day: date, latitude: float) -> float:
    """Rough seasonal NDVI baseline: peaks mid-season, hemisphere-aware."""
    doy = day.timetuple().tm_yday
    phase = (doy - 105) / 365.0 * 2 * np.pi  # peak ~mid-July (northern)
    if latitude < 0:
        phase += np.pi
    return 0.52 + 0.16 * float(np.cos(phase))


def analyze_synthetic(
    geometry: GeoJsonGeometry, end_date: str | None, window_days: int
) -> NdviResponse:
    geom = shape(geometry.model_dump())
    if geom.is_empty or geom.area == 0:
        raise ValueError("Farm geometry has no area")

    target = date.fromisoformat(end_date) if end_date else date.today()
    # Simulated acquisition: Sentinel-2 revisits every ~5 days.
    image_date = target - timedelta(days=int(target.toordinal() % 5))

    min_lng, min_lat, max_lng, max_lat = geom.bounds
    width_deg = max(max_lng - min_lng, 1e-6)
    height_deg = max(max_lat - min_lat, 1e-6)
    aspect = width_deg / height_deg
    if aspect >= 1:
        width, height = MAX_GRID, max(16, int(MAX_GRID / aspect))
    else:
        height, width = MAX_GRID, max(16, int(MAX_GRID * aspect))

    transform = from_bounds(min_lng, min_lat, max_lng, max_lat, width, height)
    mask = rasterize(
        [(geom, 1)],
        out_shape=(height, width),
        transform=transform,
        fill=0,
        dtype="uint8",
        all_touched=True,
    ).astype(bool)

    if not mask.any():
        raise ValueError("Farm boundary rasterized to zero pixels")

    rng = np.random.default_rng(_geometry_seed(geometry, image_date))
    base = _seasonal_base(image_date, float(geom.centroid.y))

    # Smooth spatial variation: superimposed low-frequency sinusoids + noise.
    y_idx, x_idx = np.mgrid[0:height, 0:width]
    field = np.zeros((height, width), dtype=np.float64)
    for _ in range(4):
        fx, fy = rng.uniform(0.5, 3.0, size=2)
        px, py = rng.uniform(0, 2 * np.pi, size=2)
        amp = rng.uniform(0.02, 0.07)
        field += amp * np.sin(2 * np.pi * fx * x_idx / width + px) * np.sin(
            2 * np.pi * fy * y_idx / height + py
        )

    # Occasional stressed patch (models irrigation failure / pest pocket).
    if rng.random() < 0.5:
        cy, cx = rng.integers(0, height), rng.integers(0, width)
        radius = max(4, int(0.18 * min(height, width)))
        dist2 = (y_idx - cy) ** 2 + (x_idx - cx) ** 2
        field -= 0.22 * np.exp(-dist2 / (2 * radius**2))

    field += rng.normal(0, 0.015, size=(height, width))
    ndvi = np.clip(base + field, -0.1, 0.95)
    ndvi_masked = np.where(mask, ndvi, np.nan)

    stats = compute_statistics(ndvi[mask])
    png_base64 = render_ndvi_png(ndvi_masked, mask)

    return NdviResponse(
        provider="synthetic",
        image_date=image_date.isoformat(),
        cloud_cover=round(float(rng.uniform(0, 12)), 1),
        statistics=stats,
        png_base64=png_base64,
        bounds=[[min_lng, min_lat], [max_lng, max_lat]],
    )
