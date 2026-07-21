"""Render an NDVI array to a colour-mapped, transparent PNG for map overlays."""
from __future__ import annotations

import base64
import io

import numpy as np
from PIL import Image

# Red -> yellow -> green ramp (agronomic NDVI palette).
# Stops are (ndvi_value, (r, g, b)).
_PALETTE_STOPS: list[tuple[float, tuple[int, int, int]]] = [
    (-0.2, (120, 63, 4)),     # bare soil / water — brown
    (0.0, (166, 97, 26)),
    (0.2, (223, 194, 125)),   # sparse vegetation — tan
    (0.35, (246, 232, 195)),
    (0.5, (199, 234, 229)),   # transitioning
    (0.6, (128, 205, 193)),
    (0.7, (53, 151, 143)),
    (0.85, (1, 102, 94)),     # dense healthy canopy — deep green
]

# A more classic red-yellow-green agronomy palette for the exported overlay.
_RYG_STOPS: list[tuple[float, tuple[int, int, int]]] = [
    (-0.2, (165, 0, 38)),
    (0.1, (215, 48, 39)),
    (0.25, (244, 109, 67)),
    (0.35, (253, 174, 97)),
    (0.45, (254, 224, 139)),
    (0.55, (217, 239, 139)),
    (0.65, (166, 217, 106)),
    (0.75, (102, 189, 99)),
    (0.85, (26, 152, 80)),
    (0.95, (0, 104, 55)),
]


def _interpolate_color(value: float, stops: list[tuple[float, tuple[int, int, int]]]) -> tuple[int, int, int]:
    if value <= stops[0][0]:
        return stops[0][1]
    if value >= stops[-1][0]:
        return stops[-1][1]
    for (v0, c0), (v1, c1) in zip(stops, stops[1:]):
        if v0 <= value <= v1:
            t = (value - v0) / (v1 - v0) if v1 > v0 else 0.0
            return tuple(int(round(a + (b - a) * t)) for a, b in zip(c0, c1))  # type: ignore[return-value]
    return stops[-1][1]


def _build_lut(stops: list[tuple[float, tuple[int, int, int]]], size: int = 256) -> np.ndarray:
    """Pre-computed lookup table mapping NDVI in [-1, 1] to RGB."""
    lut = np.zeros((size, 3), dtype=np.uint8)
    values = np.linspace(-1.0, 1.0, size)
    for i, v in enumerate(values):
        lut[i] = _interpolate_color(float(v), stops)
    return lut


_LUT = _build_lut(_RYG_STOPS)


def render_ndvi_png(ndvi: np.ndarray, mask: np.ndarray) -> str:
    """
    Convert an NDVI grid (float, NaN outside farm) + boolean mask into a
    base64-encoded RGBA PNG. Pixels outside the mask are fully transparent.
    """
    if ndvi.shape != mask.shape:
        raise ValueError("ndvi and mask must have the same shape")

    clipped = np.clip(np.nan_to_num(ndvi, nan=0.0), -1.0, 1.0)
    indices = ((clipped + 1.0) / 2.0 * 255).astype(np.uint8)
    rgb = _LUT[indices]

    alpha = np.where(mask & ~np.isnan(ndvi), 200, 0).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])

    image = Image.fromarray(rgba, mode="RGBA")
    # Upscale small grids so Leaflet renders a smooth overlay.
    max_dim = max(image.size)
    if max_dim < 512:
        scale = max(1, 512 // max_dim)
        image = image.resize((image.width * scale, image.height * scale), Image.NEAREST)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def png_bytes_to_base64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")
