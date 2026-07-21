# Docker Setup

Everything runs with a single command:

```bash
cp .env.example .env      # set production secrets first!
docker compose up --build
```

| Service | Image | Port | Notes |
|---|---|---|---|
| `frontend` | nginx + Vite build | `8080` | Serves the SPA, proxies `/api/` and `/docs` to the backend |
| `backend` | node:18-alpine | `4000` | Runs migrations + seed on startup, then the API |
| `python-service` | python:3.11-slim | `8000` | GIS/NDVI + weather; GEE optional |

## Files

- `docker-compose.yml` — orchestration, volumes, healthchecks
- `docker/backend.Dockerfile` — multi-stage build (shared → prisma generate → tsc)
- `docker/backend-entrypoint.sh` — `prisma migrate deploy` + idempotent seed + start
- `docker/python-service.Dockerfile` — pip install (GDAL bundled in wheels)
- `docker/frontend.Dockerfile` — Vite build (`VITE_API_BASE_URL=/api/v1`) → nginx
- `docker/nginx.conf` — SPA fallback + API proxy + asset caching

## Volumes

| Volume | Mounted at | Contents |
|---|---|---|
| `geoagri-data` | `backend:/app/database` | SQLite DB, uploads, reports, NDVI overlays |
| `geoagri-gis-data` | `python-service:/app/data` | GIS scratch data |
| `./python-service/credentials` | `python-service:/app/credentials` (ro) | GEE service-account key |

Back up by archiving the `geoagri-data` volume.

## Environment inside compose

`docker-compose.yml` overrides the relevant URLs automatically:

- backend → GIS: `PYTHON_SERVICE_URL=http://python-service:8000`
- backend DB: `DATABASE_URL=file:/app/database/geoagri.db`
- frontend → backend: nginx proxies `/api/` to `backend:4000`

Set these in `.env` before production use:

```env
NODE_ENV=production
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
GIS_SERVICE_API_KEY=<openssl rand -hex 32>
CORS_ORIGINS=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

## Google Earth Engine in Docker

Place the service-account JSON at
`python-service/credentials/gee-service-account.json` and set:

```env
GEE_SERVICE_ACCOUNT_EMAIL=my-sa@project.iam.gserviceaccount.com
GEE_PRIVATE_KEY_FILE=/app/credentials/gee-service-account.json
```

## Handy commands

```bash
docker compose logs -f backend        # follow API logs
docker compose exec backend npx prisma studio   # inspect the DB
docker compose down                   # stop (volumes persist)
docker compose down -v                # stop and DELETE all data
```
