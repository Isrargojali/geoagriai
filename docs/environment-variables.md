# Environment Variables

All variables live in the root `.env` (copy from `.env.example`). The Prisma
CLI additionally reads `prisma/.env` (copy from `prisma/.env.example`).

## General

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `test` / `production` |

## Backend (Fastify)

| Variable | Default | Description |
|---|---|---|
| `BACKEND_PORT` | `4000` | API listen port |
| `BACKEND_HOST` | `0.0.0.0` | API bind address |
| `FRONTEND_URL` | `http://localhost:5173` | Used in email links |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `JWT_ACCESS_SECRET` | dev value | **Required in production.** Signs access tokens |
| `JWT_REFRESH_SECRET` | dev value | **Required in production.** Reserved for future JWT refresh strategy (refresh tokens are opaque + hashed in DB) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime |
| `RATE_LIMIT_MAX` | `100` | Requests per window per IP |
| `RATE_LIMIT_WINDOW` | `1 minute` | Rate-limit window |
| `MAX_UPLOAD_MB` | `10` | Max upload size (boundaries, screenshots, QR codes) |

## Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:../database/geoagri.db` | Prisma datasource. Relative `file:` paths resolve against `prisma/`. Swap for `postgresql://…` when migrating |

## GIS service

| Variable | Default | Description |
|---|---|---|
| `PYTHON_SERVICE_URL` | `http://127.0.0.1:8000` | Backend → GIS base URL (use the service name in Docker). Use `127.0.0.1`, not `localhost` — Node 18 fetch prefers IPv6 |
| `PYTHON_SERVICE_PORT` | `8000` | GIS service listen port |
| `GIS_SERVICE_API_KEY` | dev value | Shared secret; sent as `X-API-Key` |
| `GEE_SERVICE_ACCOUNT_EMAIL` | *(empty)* | GEE service account. Empty ⇒ synthetic mode |
| `GEE_PRIVATE_KEY_FILE` | *(empty)* | Path to the service-account JSON key |
| `MAX_CLOUD_PCT` | `40` | Max Sentinel-2 scene cloudiness accepted |
| `WEATHER_API_BASE_URL` | `https://api.open-meteo.com/v1` | Weather provider (no key needed) |

## Email (SMTP)

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | *(empty)* | Empty ⇒ emails are logged to the console |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | `true` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | Credentials |
| `MAIL_FROM` | `GeoAgri AI <no-reply@geoagri.ai>` | Sender |

## File storage

| Variable | Default | Description |
|---|---|---|
| `UPLOADS_DIR` | `../database/uploads` | Payment proofs & QR codes |
| `REPORTS_DIR` | `../database/reports` | Generated PDFs/CSVs & invoices |
| `NDVI_DIR` | `../database/ndvi` | NDVI overlay PNGs |

Relative paths resolve against the backend package root.

## Frontend (Vite — baked at build time)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | API base URL. In Docker the nginx proxy uses `/api/v1` |

## Seed overrides

| Variable | Default | Description |
|---|---|---|
| `SEED_ADMIN_EMAIL` | `admin@geoagri.ai` | Initial admin account |
| `SEED_ADMIN_PASSWORD` | `Admin1234!` | Change after first login |
