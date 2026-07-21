# 🛰️ GeoAgri AI — Smart Farming from Space

GeoAgri AI is an AI-powered GIS & Remote Sensing SaaS platform that helps farmers
monitor crop health using free Sentinel-2 satellite imagery. It combines
**Google Earth Engine**, **NDVI analysis**, **weather data** and a transparent
**AI recommendation engine** into a simple dashboard with reports, subscriptions
and manual payment verification.

> **Design rule:** the AI *never* calculates NDVI. All scientific computation
> happens in the Python GIS service; the AI layer only interprets results — and
> always explains *why* a recommendation was generated.

## Architecture

```
┌────────────┐   REST    ┌─────────────┐  internal  ┌───────────────────┐
│  Frontend   │ ────────▶ │   Backend    │ ─────────▶ │  Python GIS svc    │
│ React+Vite  │           │ Fastify+TS   │  X-API-Key │  FastAPI + GEE     │
│ Leaflet     │ ◀──────── │ Prisma+SQLite│ ◀───────── │  Sentinel-2 NDVI   │
│ Chart.js    │   JWT     │ Zod + OpenAPI│            │  Open-Meteo        │
└────────────┘           └─────────────┘            └───────────────────┘
```

| Piece | Stack |
|---|---|
| `frontend/` | React 18, TypeScript, Vite, TailwindCSS, React Router, React Query, Leaflet (+draw), Chart.js |
| `backend/` | Node.js 18, Fastify, Prisma (SQLite → PostgreSQL-ready), JWT, Zod, OpenAPI, pdfkit |
| `python-service/` | Python 3.11+, FastAPI, Google Earth Engine, rasterio, shapely, geopandas, NumPy |
| `packages/shared/` | Shared TypeScript types, Zod schemas, constants |
| `prisma/` | Database schema, migrations, seed |
| `docker/` | Dockerfiles + nginx config for `docker compose` |

## Features

- **Auth** — register (14-day free trial), login, JWT with rotating refresh
  tokens, email verification, password reset, profile.
- **Farms** — draw boundaries on a satellite map, or upload GeoJSON/KML;
  automatic geodesic area & centroid calculation.
- **Satellite analysis** — Sentinel-2 via Google Earth Engine with cloud
  filtering/masking, clipped NDVI, statistics, health score, colour-mapped
  overlay, historical comparison. A deterministic **synthetic provider** keeps
  the entire product working with no GEE credentials (local dev/demo).
- **AI recommendations** — rule-based interpretation of NDVI + weather +
  history with explicit reasons for every recommendation.
- **Weather** — current conditions + 7-day forecast (Open-Meteo, no API key).
- **Reports** — branded PDF crop-health reports and CSV exports.
- **Subscriptions** — trial limits (1 farm, 5 analyses/day, 30 total), Starter
  $9.99/mo, Professional $29.99/mo, Enterprise (contact sales).
- **Manual payments** — JazzCash / EasyPaisa / bank transfer with proof upload,
  admin approval, invoice PDF generation. `PaymentProvider` interface scaffolds
  future gateways (Stripe, PayPal, …) without implementing them.
- **Admin dashboard** — users, farms, payments approval, subscriptions, plans,
  payment settings (all DB-stored, nothing hardcoded), analytics.
- **Security** — helmet, CORS, rate limiting, bcrypt, RBAC, audit logs,
  Zod validation everywhere.

## Quick start (local development)

```bash
# 0. Requirements: Node.js >= 18, Python >= 3.11
cp .env.example .env
cp prisma/.env.example prisma/.env

# 1. Node workspaces
npm install
npm run build -w @geoagri/shared

# 2. Database (SQLite — no server needed)
npm run db:migrate -w @geoagri/backend      # creates database/geoagri.db
npm run db:seed -w @geoagri/backend         # roles, plans, settings, admin

# 3. Python GIS service
cd python-service
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --port 8000 &
cd ..

# 4. Backend + frontend
npm run dev:backend &        # http://127.0.0.1:4000  (docs at /docs)
npm run dev:frontend         # http://localhost:5173
```

Default admin (change immediately): `admin@geoagri.ai` / `Admin1234!`

Without Google Earth Engine credentials the GIS service runs in **synthetic
mode** — the full workflow (analysis → AI → reports) works end-to-end with
realistic generated data. See [docs/installation.md](docs/installation.md) for
enabling real Sentinel-2 imagery.

## Quick start (Docker)

```bash
cp .env.example .env    # set real JWT secrets for production!
docker compose up --build
# Frontend: http://localhost:8080   API: http://localhost:4000   GIS: http://localhost:8000
```

## Tests

```bash
npm run test -w @geoagri/backend      # 35 unit/integration/API tests
npm run test -w @geoagri/frontend     # component & helper tests
cd python-service && .venv/bin/python -m pytest   # GIS service tests
node tests/e2e-smoke.mjs              # full-stack workflow (stack must be running)
```

## Documentation

| Doc | Contents |
|---|---|
| [docs/installation.md](docs/installation.md) | Detailed setup incl. Google Earth Engine & SMTP |
| [docs/environment-variables.md](docs/environment-variables.md) | Every variable explained |
| [docs/docker.md](docs/docker.md) | Docker & compose reference |
| [docs/api.md](docs/api.md) | REST API overview (full OpenAPI at `/docs`) |
| [docs/database.md](docs/database.md) | Schema & PostgreSQL/PostGIS migration path |
| [docs/developer-guide.md](docs/developer-guide.md) | Architecture, conventions, adding modules |
| [docs/deployment.md](docs/deployment.md) | Production deployment guide |

## License

Proprietary — © GeoAgri AI. All rights reserved.
