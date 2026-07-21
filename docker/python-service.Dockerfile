# GeoAgri AI — Python GIS & Remote Sensing service (FastAPI + GEE)
# Build context: repository root
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# GDAL/PROJ are bundled inside the rasterio/pyproj manylinux wheels, so no
# system GDAL install is required. libexpat is needed by some geo wheels.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libexpat1 curl \
 && rm -rf /var/lib/apt/lists/*

COPY python-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY python-service/app app

RUN mkdir -p /app/data/ndvi /app/credentials

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
