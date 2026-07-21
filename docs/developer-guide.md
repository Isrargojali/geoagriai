# Developer Guide

## Monorepo layout

```
geoagri-ai/
├── packages/shared/   # Types, Zod schemas, constants — single source of truth
├── prisma/            # schema.prisma, migrations, seed.ts
├── backend/           # Fastify API (ESM TypeScript, NodeNext)
│   └── src/
│       ├── config/env.ts        # zod-validated environment
│       ├── plugins/             # auth (JWT/RBAC), swagger
│       ├── lib/                 # prisma, errors, mailer, audit, crypto, json
│       ├── schemas/dto.ts       # zod response schemas (serialization + OpenAPI)
│       └── modules/<feature>/   # routes + service per feature
├── python-service/    # FastAPI GIS service (GEE, NDVI, weather)
├── frontend/          # React SPA
│   └── src/{api,components,lib,pages}
├── docker/            # Dockerfiles, nginx.conf, entrypoint
├── docs/              # This documentation
└── tests/             # Full-stack E2E smoke test
```

## Architecture principles

1. **Layered modules** — each backend feature is `*.routes.ts` (HTTP: schema,
   auth, status codes) + `*.service.ts` (business logic, Prisma). Routes never
   contain business logic; services never touch HTTP.
2. **Scientific/AI separation** — NDVI and statistics are computed only in the
   Python GIS service. `recommendation.engine.ts` is a pure function over those
   inputs and must stay free of scientific computation; every output includes
   `reasons[]` for explainability.
3. **Shared contracts** — DTO types and request Zod schemas live in
   `@geoagri/shared` and are imported by both frontend and backend, so the two
   cannot drift.
4. **Swappable storage** — geometry math is confined to
   `farms/geometry.service.ts`; JSON-in-string columns are confined to
   `lib/json.ts` (see [database.md](database.md) for the PostGIS path).
5. **Payments as providers** — `payments/providers/payment-provider.ts` defines
   the interface; only `ManualPaymentProvider` is active. Future gateways
   (Stripe, PayPal, JazzCash API, …) are scaffolded in `future.providers.ts`
   and disabled — implement `initiatePayment` + a webhook route and flip
   `isEnabled()` to add one, without touching checkout flow code.

## Conventions

- **ESM everywhere** — backend uses NodeNext resolution: relative imports need
  the `.js` extension.
- **Errors** — throw typed `AppError` subclasses (`lib/errors.ts`); the global
  handler maps them to the uniform error envelope. Plan-limit violations use
  `LimitExceededError` (HTTP 402).
- **Validation** — request schemas from `@geoagri/shared`, response schemas
  from `backend/src/schemas/dto.ts`; both feed the generated OpenAPI spec.
- **Audit** — every security/business mutation calls `audit({...})`
  (best-effort, never throws).
- **Notifications & email** — user-facing events create a `Notification` and,
  where relevant, send email through `lib/mailer.ts` (console fallback in dev).

## Adding a backend module

1. Create `backend/src/modules/<name>/<name>.service.ts` and
   `<name>.routes.ts`.
2. Add request schemas to `packages/shared/src/schemas.ts` and DTO types to
   `types.ts`; rebuild shared (`npm run build -w @geoagri/shared`).
3. Register the routes in `backend/src/app.ts` and add an OpenAPI tag in
   `plugins/swagger.ts`.
4. Add tests in `backend/tests/` (unit for services, `app.inject()` for API).

## Frontend patterns

- Data fetching via React Query hooks in `src/api/hooks.ts` (user) and
  `src/api/admin.ts` (admin); mutations invalidate affected query keys.
- `lib/api.ts` handles auth headers, automatic refresh-token rotation on 401,
  and protected binary downloads (NDVI overlays/reports need the JWT, so they
  are fetched as blobs).
- Maps: `components/map/FarmMap.tsx` (display + NDVI `ImageOverlay`) and
  `DrawMap.tsx` (leaflet-draw polygon editor).
- Dark mode: class strategy (`dark:` variants) toggled by `lib/theme.tsx`.
- Guards: `RequireAuth` / `RequireAdmin` in `App.tsx`.

## Testing

| Suite | Command | Covers |
|---|---|---|
| Backend | `npm run test -w @geoagri/backend` | Recommendation engine, geometry, auth/farms/payments APIs against a throwaway SQLite DB |
| Python | `pytest` in `python-service/` | Statistics, synthetic provider, FastAPI endpoints |
| Frontend | `npm run test -w @geoagri/frontend` | Helpers + UI components (jsdom) |
| E2E | `node tests/e2e-smoke.mjs` | Whole workflow against a running stack |

## Useful commands

```bash
npm run build                 # shared → backend → frontend
npm run db:studio -w @geoagri/backend
npm run typecheck -w @geoagri/backend
npm run typecheck -w @geoagri/frontend
```
