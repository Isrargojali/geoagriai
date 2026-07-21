"""NDVI statistics helpers shared by the GEE and synthetic providers."""
from __future__ import annotations

import numpy as np

from .models import NdviDistribution, NdviStatistics

# Health-band boundaries (must match NDVI_HEALTH_THRESHOLDS in @geoagri/shared).
BANDS = {
    "critical": (-1.0, 0.25),
    "poor": (0.25, 0.4),
    "moderate": (0.4, 0.55),
    "good": (0.55, 0.7),
    "excellent": (0.7, 1.0001),
}


def compute_statistics(values: np.ndarray) -> NdviStatistics:
    """Compute summary statistics from a 1-D array of valid NDVI samples."""
    if values.size == 0:
        raise ValueError("No valid NDVI pixels inside the farm boundary")

    fractions = {}
    for name, (lo, hi) in BANDS.items():
        fractions[name] = float(np.mean((values >= lo) & (values < hi)))

    return NdviStatistics(
        min=round(float(np.min(values)), 4),
        max=round(float(np.max(values)), 4),
        mean=round(float(np.mean(values)), 4),
        std_dev=round(float(np.std(values)), 4),
        median=round(float(np.median(values)), 4),
        distribution=NdviDistribution(**{k: round(v, 4) for k, v in fractions.items()}),
        pixel_count=int(values.size),
    )


def statistics_from_histogram(
    bin_edges: np.ndarray, counts: np.ndarray, stats: dict
) -> NdviStatistics:
    """
    Build NdviStatistics from a GEE fixed histogram plus reduceRegion outputs
    (min/max/mean/stdDev/median), avoiding a full pixel download.
    """
    total = float(np.sum(counts))
    if total <= 0:
        raise ValueError("No valid NDVI pixels inside the farm boundary")

    centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0
    fractions = {}
    for name, (lo, hi) in BANDS.items():
        in_band = (centers >= lo) & (centers < hi)
        fractions[name] = float(np.sum(counts[in_band]) / total)

    return NdviStatistics(
        min=round(float(stats["min"]), 4),
        max=round(float(stats["max"]), 4),
        mean=round(float(stats["mean"]), 4),
        std_dev=round(float(stats["stdDev"]), 4),
        median=round(float(stats["median"]), 4),
        distribution=NdviDistribution(**{k: round(v, 4) for k, v in fractions.items()}),
        pixel_count=int(total),
    )
