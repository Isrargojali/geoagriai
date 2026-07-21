# Database Documentation

Prisma ORM with **SQLite** for the MVP. The schema lives in
[`prisma/schema.prisma`](../prisma/schema.prisma); migrations in
`prisma/migrations/`.

## Tables

| Model | Purpose |
|---|---|
| `Role` | `ADMIN` / `FARMER` role catalog |
| `User` | Accounts: bcrypt password hash, verification & reset tokens, role |
| `RefreshToken` | Hashed rotating refresh tokens (server-side revocation) |
| `Farm` | Farm metadata + derived `areaHectares`, centroid |
| `FarmBoundary` | 1:1 GeoJSON Polygon/MultiPolygon (`geometryJson`, SRID 4326) |
| `Analysis` | NDVI runs: status, image date, cloud cover, statistics, health score, AI recommendation, overlay path |
| `WeatherRecord` | Weather snapshots + 7-day forecast JSON (30-min cache) |
| `Report` | Generated PDF/CSV file registry |
| `Notification` | In-app notifications |
| `Plan` | Subscription plans incl. limits (`maxFarms`, `maxAnalysesPerDay`, `maxAnalysesTotal`; `null` = unlimited) |
| `Subscription` | User ↔ plan with `TRIAL/ACTIVE/EXPIRED/CANCELLED`, trial & end dates |
| `Payment` | Manual payments: method, status, reviewer, reject reason |
| `PaymentProof` | Transaction ID, amount, date, screenshot path, notes |
| `Invoice` | Sequential `GA-YYYY-NNNNNN` invoices with generated PDF |
| `Setting` | Key-value platform settings (payment accounts, support contacts) — nothing hardcoded |
| `AuditLog` | Security & business event trail (action, resource, details, IP) |

### Conventions

- IDs are `cuid()` strings.
- Enum-like columns are plain strings validated in code (SQLite has no native
  enums); constants live in `@geoagri/shared`.
- JSON payloads (statistics, recommendations, forecasts, features, audit
  details) are stored as JSON strings via `lib/json.ts` helpers.
- Deleting a `User`/`Farm` cascades to owned rows.

## Entity relationships (core)

```
Role 1─n User 1─n Farm 1─1 FarmBoundary
                  Farm 1─n Analysis n─1 WeatherRecord
                  Farm 1─n Report
User 1─n Subscription n─1 Plan
User 1─n Payment 1─1 PaymentProof
                Payment 1─1 Invoice
User 1─n Notification / AuditLog / RefreshToken
```

## Migrating to PostgreSQL + PostGIS

The schema was designed so this is a small, contained change:

1. **Datasource** — change `provider = "sqlite"` to `"postgresql"` and point
   `DATABASE_URL` at Postgres; regenerate migrations
   (`prisma migrate dev`).
2. **JSON columns** — `*Json String` columns can become native `Json` (jsonb)
   types; only `lib/json.ts` (two functions) changes.
3. **Geometry** — `FarmBoundary.geometryJson` becomes
   `geometry(MultiPolygon, 4326)`. All geometry math (area, centroid, bounds,
   validation) is isolated in
   `backend/src/modules/farms/geometry.service.ts`; replace turf calls with
   `ST_Area(geography)` / `ST_Centroid` / `ST_Envelope` queries.
4. **Enums** — optionally promote status strings to Postgres enums.

No other module touches raw geometry or JSON storage directly.

## Operations

```bash
npm run db:migrate -w @geoagri/backend   # create/apply migrations (dev)
npm run db:deploy -w @geoagri/backend    # apply committed migrations (prod)
npm run db:seed -w @geoagri/backend      # idempotent seed
npm run db:studio -w @geoagri/backend    # Prisma Studio browser
```

SQLite files live in `database/` (`geoagri.db`, plus `uploads/`, `reports/`,
`ndvi/` file storage). Back up by copying that directory.
