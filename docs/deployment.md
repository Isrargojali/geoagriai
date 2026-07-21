# Deployment Guide

## Recommended: single VM with Docker Compose

A 2 vCPU / 4 GB VM comfortably runs the whole stack for early users.

### 1. Provision

- Ubuntu 22.04+ with Docker Engine + compose plugin
- DNS `A` record (e.g. `app.yourdomain.com`) → VM IP
- Open ports 80/443 only (the compose ports for backend/GIS can be removed or
  firewalled; the frontend proxy reaches them on the internal network)

### 2. Configure

```bash
git clone <repo-url> /opt/geoagri && cd /opt/geoagri
cp .env.example .env
```

Set in `.env` (all mandatory for production):

```env
NODE_ENV=production
JWT_ACCESS_SECRET=<openssl rand -hex 64>
JWT_REFRESH_SECRET=<openssl rand -hex 64>
GIS_SERVICE_API_KEY=<openssl rand -hex 32>
FRONTEND_URL=https://app.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com
SMTP_HOST=…            # real email for verification/reset/payment mails
SEED_ADMIN_EMAIL=you@yourdomain.com
SEED_ADMIN_PASSWORD=<strong password>
```

> The backend **refuses to boot** in production with default JWT secrets.

Add the GEE key (optional but recommended for real imagery) — see
[docker.md](docker.md).

### 3. TLS termination

Put a reverse proxy with TLS in front of the frontend container (port 8080).
Example with Caddy:

```
app.yourdomain.com {
    reverse_proxy localhost:8080
}
```

(or nginx + certbot / Traefik — anything that forwards to `:8080` works, since
the frontend container already proxies `/api` internally).

### 4. Launch

```bash
docker compose up -d --build
docker compose ps          # all three services should be healthy
```

First boot applies migrations and seeds roles/plans/settings/admin
automatically.

### 5. Post-deploy checklist

- [ ] Log in as admin, change the password
- [ ] Admin → Settings: fill JazzCash/EasyPaisa/bank details + support contacts,
      upload QR codes
- [ ] Register a test farmer, create a farm, run an analysis
- [ ] `node tests/e2e-smoke.mjs https://app.yourdomain.com/api/v1`
- [ ] Set up backups of the `geoagri-data` volume (SQLite DB + files):

```bash
docker run --rm -v geoagri_geoagri-data:/data -v /backup:/backup alpine \
  tar czf /backup/geoagri-$(date +%F).tar.gz -C /data .
```

### Updating

```bash
cd /opt/geoagri && git pull
docker compose up -d --build     # entrypoint re-runs migrate deploy
```

## Scaling path (beyond MVP)

1. **PostgreSQL + PostGIS** — see [database.md](database.md); removes the
   single-writer SQLite constraint.
2. **Object storage** — move `uploads/reports/ndvi` to S3-compatible storage
   (all file paths flow through the files/reports modules).
3. **Queue for analyses** — `runAnalysis` is synchronous in the MVP; extract it
   behind a job queue (BullMQ) when GEE latency or volume grows.
4. **Managed email** — SES/Postmark via the existing SMTP config.
