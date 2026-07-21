"""Unit tests for NDVI statistics computation."""
import numpy as np
import pytest

from app.stats import compute_statistics, statistics_from_histogram


def test_compute_statistics_basic():
    values = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
    stats = compute_statistics(values)
    assert stats.min == 0.1
    assert stats.max == 0.9
    assert stats.mean == pytest.approx(0.5, abs=1e-4)
    assert stats.median == pytest.approx(0.5, abs=1e-4)
    assert stats.pixel_count == 5

    dist = stats.distribution
    total = dist.critical + dist.poor + dist.moderate + dist.good + dist.excellent
    assert total == pytest.approx(1.0, abs=1e-3)
    # 0.1 is critical, 0.3 poor, 0.5 moderate, 0.7 & 0.9 excellent
    assert dist.critical == pytest.approx(0.2, abs=1e-3)
    assert dist.poor == pytest.approx(0.2, abs=1e-3)
    assert dist.moderate == pytest.approx(0.2, abs=1e-3)
    assert dist.excellent == pytest.approx(0.4, abs=1e-3)


def test_compute_statistics_empty_raises():
    with pytest.raises(ValueError):
        compute_statistics(np.array([]))


def test_statistics_from_histogram():
    bin_edges = np.linspace(-1, 1, 41)  # 40 bins of width 0.05
    counts = np.zeros(40)
    # Put 100 pixels around NDVI 0.6 (bin index for 0.6..0.65 is 32)
    counts[32] = 100
    stats = statistics_from_histogram(
        bin_edges,
        counts,
        {"min": 0.6, "max": 0.65, "mean": 0.62, "stdDev": 0.01, "median": 0.62},
    )
    assert stats.pixel_count == 100
    assert stats.distribution.good == pytest.approx(1.0, abs=1e-3)


def test_statistics_from_histogram_empty_raises():
    with pytest.raises(ValueError):
        statistics_from_histogram(np.linspace(-1, 1, 41), np.zeros(40), {})
