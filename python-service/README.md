# GeoAgri AI — GIS Service

FastAPI service performing all scientific computation: Sentinel-2 retrieval via
Google Earth Engine, cloud filtering/masking, NDVI statistics, overlay
rendering, and weather (Open-Meteo).

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000   # docs at /docs
.venv/bin/python -m pytest                   # tests
```

Endpoints (`X-API-Key` required): `POST /analyze/ndvi`, `GET /weather`,
`GET /health`.

Without GEE credentials the service runs in **synthetic mode** — a
deterministic, agronomically plausible NDVI generator that keeps the full
platform functional for development. See
[docs/installation.md](../docs/installation.md) for enabling GEE.
