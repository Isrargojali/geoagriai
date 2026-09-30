"""Tests for Earth Engine provider helpers."""

from app.gee import _thumb_dimensions


def test_thumb_dimensions_preserve_wide_farm_aspect():
    dims = _thumb_dimensions(
        min_lng=73.0,
        min_lat=31.0,
        max_lng=73.04,
        max_lat=31.01,
        max_dimension=2048,
    )

    width, height = [int(part) for part in dims.split("x")]
    assert width == 2048
    assert 256 <= height < width


def test_thumb_dimensions_preserve_tall_farm_aspect():
    dims = _thumb_dimensions(
        min_lng=73.0,
        min_lat=31.0,
        max_lng=73.01,
        max_lat=31.04,
        max_dimension=2048,
    )

    width, height = [int(part) for part in dims.split("x")]
    assert height == 2048
    assert 256 <= width < height
