# API Documentation

The complete, always-current **OpenAPI 3 specification** is generated from the
route schemas and served by the backend:

- Swagger UI: `http://127.0.0.1:4000/docs`
- Raw JSON: `http://127.0.0.1:4000/docs/json`

Base path: `/api/v1`. All authenticated endpoints expect
`Authorization: Bearer <accessToken>`.

## Conventions

- **Validation** — every request body/query/param is validated with Zod;
  failures return `400` with field-level details.
- **Errors** — uniform envelope:

```json
{ "statusCode": 402, "error": "LIMIT_EXCEEDED", "message": "Daily analysis limit reached (5/day)…" }
```

- **Auth** — short-lived JWT access tokens (15 min) + opaque rotating refresh
  tokens stored hashed server-side (revocable). `POST /auth/refresh` rotates the
  pair; reusing an old refresh token fails.
- **Rate limiting** — global limit plus stricter per-route limits on auth and
  analysis endpoints.

## Endpoint overview

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | API + database + GIS service status |

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account, start 14-day trial, return tokens |
| POST | `/auth/login` | Email/password login |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke a refresh token |
| POST | `/auth/verify-email` | Verify email with emailed token |
| POST | `/auth/resend-verification` 🔒 | Resend verification email |
| POST | `/auth/forgot-password` | Request reset email (never leaks existence) |
| POST | `/auth/reset-password` | Set new password; revokes all sessions |

### Users
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` 🔒 | Current profile |
| PATCH | `/users/me` 🔒 | Update name/phone |
| POST | `/users/me/change-password` 🔒 | Change password |

### Farms
| Method | Path | Description |
|---|---|---|
| GET | `/farms` 🔒 | List own farms (boundary + latest analysis) |
| GET | `/farms/:farmId` 🔒 | Single farm |
| POST | `/farms` 🔒 | Create from drawn polygon (JSON geometry) |
| POST | `/farms/upload` 🔒 | Create from GeoJSON/KML upload (multipart) |
| PATCH | `/farms/:farmId` 🔒 | Update metadata and/or boundary |
| DELETE | `/farms/:farmId` 🔒 | Delete farm (cascades analyses/reports) |

### Analyses
| Method | Path | Description |
|---|---|---|
| POST | `/farms/:farmId/analyses` 🔒 | Run NDVI analysis (GIS → weather → AI); subject to plan limits |
| GET | `/farms/:farmId/analyses` 🔒 | Paginated history |
| GET | `/farms/:farmId/analyses/history` 🔒 | NDVI time series for charts |
| GET | `/analyses/:analysisId` 🔒 | Full analysis: statistics, weather, recommendation, overlay |

### Weather
| Method | Path | Description |
|---|---|---|
| GET | `/farms/:farmId/weather` 🔒 | Current + 7-day forecast (30-min cache) |

### Reports
| Method | Path | Description |
|---|---|---|
| POST | `/reports/farms/:farmId` 🔒 | Generate PDF (per-analysis) or CSV (all analyses) |
| GET | `/reports` 🔒 | List generated reports |
| GET | `/reports/:reportId/download` 🔒 | Download file |

### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/notifications` 🔒 | Recent notifications (`?unreadOnly=true`) |
| POST | `/notifications/:id/read` 🔒 | Mark one read |
| POST | `/notifications/read-all` 🔒 | Mark all read |

### Plans / Subscription
| Method | Path | Description |
|---|---|---|
| GET | `/plans` | Purchasable plans |
| GET | `/subscription` 🔒 | Current subscription (lazy-expires) |
| GET | `/subscription/usage` 🔒 | Usage vs limits + `canCreateFarm` / `canRunAnalysis` |

### Payments (manual verification)
| Method | Path | Description |
|---|---|---|
| GET | `/payments/instructions/:method` 🔒 | Display data for JAZZCASH / EASYPAISA / BANK_TRANSFER |
| POST | `/payments` 🔒 | Start a payment for a plan → instructions |
| POST | `/payments/:paymentId/proof` 🔒 | Upload proof (multipart: transactionId, amount, paymentDate, method, notes?, screenshot) |
| GET | `/payments` 🔒 | Own payment history |
| GET | `/payments/invoices` 🔒 | Own invoices |
| GET | `/payments/invoices/:invoiceId/download` 🔒 | Invoice PDF |

### Settings & files
| Method | Path | Description |
|---|---|---|
| GET | `/settings/public` 🔒 | Public settings (payment instructions, support contacts) |
| GET | `/files/ndvi/:fileName` 🔒 | NDVI overlay PNG (owner/admin only) |
| GET | `/files/uploads/:fileName` 🔒 | Payment proof (owner/admin only) |
| GET | `/files/qr/:fileName` | Public payment QR code |

### Admin (role `ADMIN`)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/analytics` | Platform KPIs + 30-day charts |
| GET / PATCH | `/admin/users`, `/admin/users/:id` | Manage users (activate, role, verification) |
| GET | `/admin/farms` | All farms |
| GET | `/admin/payments` | Payments by status |
| POST | `/admin/payments/:id/approve` | Approve → activate subscription + invoice + email |
| POST | `/admin/payments/:id/reject` | Reject with reason + email |
| GET / POST | `/admin/subscriptions`, `…/:id/cancel` | Manage subscriptions |
| GET / PUT | `/admin/plans`, `/admin/plans/:id` | Manage plans |
| GET / PUT | `/admin/settings` | Payment/support settings |
| POST | `/admin/settings/qr/:settingKey` | Upload payment QR code |

🔒 = requires `Authorization: Bearer <token>`.
