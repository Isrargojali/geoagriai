# @geoagri/shared

Single source of truth for contracts shared by the frontend and backend:

- `constants.ts` — roles, statuses, plan slugs, limits, NDVI health thresholds,
  setting keys, audit actions
- `types.ts` — API DTO types (farms, analyses, payments, …)
- `schemas.ts` — Zod request schemas (validated on both client and server)
- `health.ts` — NDVI→health interpretation helpers and weather code labels

Build before anything that imports it: `npm run build -w @geoagri/shared`.
