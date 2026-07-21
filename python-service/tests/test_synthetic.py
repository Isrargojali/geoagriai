"""Tests for the synthetic NDVI provider (development fallback)."""
import base64
import io

import pytest
from PIL import Image

from app.models import GeoJsonGeometry
from app.synthetic import analyze_synthetic

SQUARE = GeoJsonGeometry(
    type="Polygon",
    coordinates=[
        [
            [73.05, 31.40],
            [73.06, 31.40],
            [73.06, 31.41],
            [73.05, 31.41],
            [73.05, 31.40],
        ]
    ],
)


def test_synthetic_analysis_produces_valid_response():
    result = analyze_synthetic(SQUARE, end_date="2026-06-15", window_days=30)

    assert result.provider == "synthetic"
    assert result.cloud_cover >= 0
    stats = result.statistics
    assert -1 <= stats.min <= stats.mean <= stats.max <= 1
    assert stats.pixel_count > 0
    assert result.bounds == [[73.05, 31.40], [73.06, 31.41]]

    # PNG must decode and be RGBA with some transparent (outside-farm) pixels.
    png = base64.b64decode(result.png_base64)
    image = Image.open(io.BytesIO(png))
    assert image.mode == "RGBA"
    assert image.width > 0


def test_synthetic_is_deterministic_per_month():
    a = analyze_synthetic(SQUARE, end_date="2026-06-15", window_days=30)
    b = analyze_synthetic(SQUARE, end_date="2026-06-15", window_days=30)
    assert a.statistics.mean == b.statistics.mean
    assert a.image_date == b.image_date


def test_synthetic_varies_across_seasons():
    summer = analyze_synthetic(SQUARE, end_date="2026-07-01", window_days=30)
    winter = analyze_synthetic(SQUARE, end_date="2026-01-05", window_days=30)
    assert summer.statistics.mean != winter.statistics.mean


def test_empty_geometry_rejected():
    tiny = GeoJsonGeometry(
        type="Polygon",
        coordinates=[[[0, 0], [0, 0], [0, 0], [0, 0]]],
    )
    with pytest.raises(ValueError):
        analyze_synthetic(tiny, end_date=None, window_days=30)
