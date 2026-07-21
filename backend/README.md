# @geoagri/backend

Fastify + Prisma REST API for GeoAgri AI.

- **Dev:** `npm run dev -w @geoagri/backend` → http://127.0.0.1:4000 (OpenAPI at `/docs`)
- **Build/start:** `npm run build && npm start` (from this package)
- **Tests:** `npm run test -w @geoagri/backend`
- **DB:** `npm run db:migrate` / `db:seed` / `db:studio` (schema in `../prisma/`)

Structure: `src/modules/<feature>/{*.routes.ts,*.service.ts}` — see
[docs/developer-guide.md](../docs/developer-guide.md).
