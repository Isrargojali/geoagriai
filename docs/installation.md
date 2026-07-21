# Installation Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | npm workspaces are used |
| Python | ≥ 3.11 | 3.11–3.13 tested |
| Docker (optional) | ≥ 24 | for containerized deployment |

No database server is required — the MVP uses SQLite via Prisma.

## 1. Clone & configure

```bash
git clone <repo-url> geoagri-ai && cd geoagri-ai
cp .env.example .env          # runtime configuration (all services)
cp prisma/.env.example prisma/.env   # used by the Prisma CLI only
```

Open `.env` and set at minimum:

- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — long random strings
  (`openssl rand -hex 64`). The API refuses to start in production with the
  defaults.
- `GIS_SERVICE_API_KEY` — shared secret between backend and GIS service.

## 2. Install Node workspaces

```bash
npm install
npm run build -w @geoagri/shared   # shared types/schemas must be built first
```

## 3. Database

```bash
npm run db:migrate -w @geoagri/backend   # applies migrations, creates database/geoagri.db
npm run db:seed -w @geoagri/backend      # roles, plans, settings, admin account
```

The seed is idempotent. It creates:

- Roles `ADMIN` and `FARMER`
- Plans: Free Trial, Starter ($9.99), Professional ($29.99), Enterprise
- Empty payment settings (fill them in the admin dashboard)
- Admin account `admin@geoagri.ai` / `Admin1234!` (override with
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; change the password after first login)

## 4. Python GIS service

```bash
cd python-service
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt   # requirements.txt for runtime only
.venv/bin/uvicorn app.main:app --port 8000
```

> GDAL/PROJ are bundled inside the `rasterio`/`pyproj` wheels — no system GDAL
> installation is needed.

### Enabling Google Earth Engine (optional but recommended)

Without credentials the service runs in **synthetic mode** (deterministic,
realistic NDVI so every feature works). To use real Sentinel-2 imagery:

1. Create a [Google Cloud project](https://console.cloud.google.com) and enable
   the **Earth Engine API**.
2. Register the project for Earth Engine access at
   <https://code.earthengine.google.com/register>.
3. Create a **service account**, grant it the *Earth Engine Resource Viewer*
   role, and download its JSON key.
4. Save the key as `python-service/credentials/gee-service-account.json`.
5. Set in `.env`:

```env
GEE_SERVICE_ACCOUNT_EMAIL=my-sa@my-project.iam.gserviceaccount.com
GEE_PRIVATE_KEY_FILE=/absolute/path/to/python-service/credentials/gee-service-account.json
```

6. Restart the GIS service; `GET /health` should report `"gee_enabled": true`.

## 5. Run the apps

```bash
npm run dev:backend    # Fastify API on http://127.0.0.1:4000 — OpenAPI docs at /docs
npm run dev:frontend   # Vite dev server on http://localhost:5173
```

## 6. Email (optional)

Leave `SMTP_HOST` empty in development — verification/reset emails are printed
to the backend console. For real email set `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

## 7. Verify the installation

```bash
npm run test -w @geoagri/backend
cd python-service && .venv/bin/python -m pytest && cd ..
node tests/e2e-smoke.mjs        # requires backend + GIS service running
```

All suites should pass. The smoke test exercises the complete user workflow:
registration → trial → farm creation → NDVI analysis → weather → AI
recommendation → PDF/CSV reports → manual payment initiation.
