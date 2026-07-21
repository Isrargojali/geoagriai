#!/bin/sh
set -e

echo "Applying database migrations…"
DATABASE_URL="${DATABASE_URL:-file:/app/database/geoagri.db}" \
  npx prisma migrate deploy --schema prisma/schema.prisma

echo "Seeding reference data (idempotent)…"
DATABASE_URL="${DATABASE_URL:-file:/app/database/geoagri.db}" \
  npx tsx prisma/seed.ts || echo "Seed skipped/failed (non-fatal on restart)"

echo "Starting GeoAgri AI API…"
exec node backend/dist/server.js
