"""
Google Earth Engine provider — retrieves Sentinel-2 surface-reflectance
imagery, applies cloud filtering/masking, clips to the farm boundary and
computes NDVI statistics plus a colour-mapped overlay PNG.
"""
from __future__ import annotations

import io
import math
from datetime import date, timedelta
from typing import Optional

import httpx
import numpy as np
from PIL import Image

from .config import get_settings
from .models import GeoJsonGeometry, NdviResponse
from .ndvi_render import png_bytes_to_base64
from .stats import statistics_from_histogram

_initialized = False

# Visualization palette for the exported overlay (red -> yellow -> green).
_VIS_PALETTE = [
    "a50026", "d73027", "f46d43", "fdae61", "fee08b",
    "d9ef8b", "a6d96a", "66bd63", "1a9850", "006837",
]
_VIS_MIN, _VIS_MAX = -0.2, 0.95
_HISTOGRAM_BINS = 80
_SCALE_M = 10  # Sentinel-2 red/NIR native resolution
_QUALITY_SCALE_M = 20


class GeeUnavailableError(RuntimeError):
    """Raised when GEE is not configured or no suitable imagery exists."""


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    settings = get_settings()
    if not settings.gee_enabled:
        raise GeeUnavailableError("Google Earth Engine credentials are not configured")

    import ee  # deferred import: heavy, and optional in synthetic mode

    credentials = ee.ServiceAccountCredentials(
        settings.gee_service_account, settings.gee_key_file
    )
    ee.Initialize(credentials)
    _initialized = True


def _mask_s2_clouds(image):
    """Mask clouds & cirrus using the Sentinel-2 scene classification (SCL)."""
    import ee

    scl = image.select("SCL")
    # SCL classes excluded: 0 no data, 1 saturated/defective, 3 cloud shadow,
    # 8 cloud medium prob, 9 cloud high prob, 10 thin cirrus, 11 snow/ice.
    good = (
        scl.neq(0)
        .And(scl.neq(1))
        .And(scl.neq(3))
        .And(scl.neq(8))
        .And(scl.neq(9))
        .And(scl.neq(10))
        .And(scl.neq(11))
    )
    return image.updateMask(good)


def _score_farm_clear_pixels(image, region):
    """Set clear-pixel quality properties for the submitted farm geometry."""
    import ee

    masked = _mask_s2_clouds(image)
    valid_mask = masked.select("B8").mask().rename("valid")
    valid_ratio = valid_mask.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=region,
        scale=_QUALITY_SCALE_M,
        maxPixels=1_000_000_000,
        bestEffort=True,
    ).get("valid")
    valid_ratio = ee.Number(ee.Algorithms.If(valid_ratio, valid_ratio, 0))
    scene_cloud = ee.Number(image.get("CLOUDY_PIXEL_PERCENTAGE"))

    # Prefer cloud-free farm pixels over low whole-tile cloudiness. Whole
    # Sentinel-2 tiles can be clean overall while the farm itself is cloudy.
    quality_score = valid_ratio.subtract(scene_cloud.divide(100).multiply(0.25))
    return image.set(
        {
            "farm_clear_ratio": valid_ratio,
            "farm_quality_score": quality_score,
        }
    )


def analyze_gee(
    geometry: GeoJsonGeometry,
    end_date: Optional[str],
    window_days: int,
    max_cloud_pct: Optional[float],
) -> NdviResponse:
    _ensure_initialized()
    import ee

    settings = get_settings()
    cloud_limit = max_cloud_pct if max_cloud_pct is not None else settings.max_cloud_pct

    target = date.fromisoformat(end_date) if end_date else date.today()
    start = target - timedelta(days=window_days)

    region = ee.Geometry(geometry.model_dump())

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(region)
        .filterDate(start.isoformat(), (target + timedelta(days=1)).isoformat())
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", cloud_limit))
        .map(lambda img: _score_farm_clear_pixels(img, region))
        .filter(ee.Filter.gte("farm_clear_ratio", settings.min_farm_clear_ratio))
        .sort("farm_quality_score", False)
    )

    size = int(collection.size().getInfo())
    if size == 0:
        raise GeeUnavailableError(
            f"No Sentinel-2 image with <= {cloud_limit:.0f}% scene cloud cover "
            f"and >= {settings.min_farm_clear_ratio:.0%} clear farm pixels found "
            f"between {start.isoformat()} and {target.isoformat()} for this farm"
        )

    image = ee.Image(collection.first())
    info = image.getInfo()["properties"]
    cloud_cover = float(info.get("CLOUDY_PIXEL_PERCENTAGE", 0.0))
    farm_clear_ratio = float(info.get("farm_clear_ratio", 0.0))
    timestamp_ms = int(info["system:time_start"])
    image_date = date.fromtimestamp(timestamp_ms / 1000).isoformat()

    masked = _mask_s2_clouds(image)
    ndvi = masked.normalizedDifference(["B8", "B4"]).rename("NDVI").clip(region)

    reducers = (
        ee.Reducer.minMax()
        .combine(ee.Reducer.mean(), sharedInputs=True)
        .combine(ee.Reducer.stdDev(), sharedInputs=True)
        .combine(ee.Reducer.median(), sharedInputs=True)
        .combine(ee.Reducer.fixedHistogram(-1, 1, _HISTOGRAM_BINS), sharedInputs=True)
    )
    reduced = ndvi.reduceRegion(
        reducer=reducers,
        geometry=region,
        scale=_SCALE_M,
        maxPixels=1_000_000_000,
        bestEffort=True,
    ).getInfo()

    if reduced.get("NDVI_mean") is None:
        raise GeeUnavailableError(
            "The selected image has no cloud-free pixels over this farm"
        )

    histogram = np.array(reduced["NDVI_histogram"], dtype=np.float64)
    bin_edges = np.append(histogram[:, 0], 1.0)
    counts = histogram[:, 1]

    stats = statistics_from_histogram(
        bin_edges,
        counts,
        {
            "min": reduced["NDVI_min"],
            "max": reduced["NDVI_max"],
            "mean": reduced["NDVI_mean"],
            "stdDev": reduced["NDVI_stdDev"],
            "median": reduced["NDVI_median"],
        },
    )

    min_lng, min_lat, max_lng, max_lat = _geometry_bounds(geometry)
    thumb_dimensions = _thumb_dimensions(
        min_lng,
        min_lat,
        max_lng,
        max_lat,
        max_dimension=settings.ndvi_thumb_max_dimension,
    )

    # Export a visualized overlay PNG clipped to the farm.
    visualized = ndvi.visualize(min=_VIS_MIN, max=_VIS_MAX, palette=_VIS_PALETTE)
    thumb_url = visualized.getThumbURL(
        {"region": region, "dimensions": thumb_dimensions, "format": "png"}
    )
    png = httpx.get(thumb_url, timeout=120).content
    # Validate the payload is a decodable PNG before returning it.
    Image.open(io.BytesIO(png)).verify()

    return NdviResponse(
        provider="gee",
        image_date=image_date,
        # Report the cloudiness that matters to this farm, not just the whole
        # Sentinel-2 tile. Keep the existing response field for API stability.
        cloud_cover=round(
            (1 - farm_clear_ratio) * 100 if farm_clear_ratio else cloud_cover,
            2,
        ),
        statistics=stats,
        png_base64=png_bytes_to_base64(png),
        bounds=[[min_lng, min_lat], [max_lng, max_lat]],
    )


def _geometry_bounds(geometry: GeoJsonGeometry) -> tuple[float, float, float, float]:
    from shapely.geometry import shape

    return shape(geometry.model_dump()).bounds


def _thumb_dimensions(
    min_lng: float,
    min_lat: float,
    max_lng: float,
    max_lat: float,
    *,
    max_dimension: int,
) -> str:
    """Return aspect-aware GEE thumbnail dimensions like "2048x1370"."""
    width_m = max(
        (max_lng - min_lng)
        * 111_320
        * math.cos(math.radians((min_lat + max_lat) / 2)),
        1,
    )
    height_m = max((max_lat - min_lat) * 111_320, 1)

    if width_m >= height_m:
        width = max_dimension
        height = max(256, round(max_dimension * (height_m / width_m)))
    else:
        height = max_dimension
        width = max(256, round(max_dimension * (width_m / height_m)))

    return f"{width}x{height}"
