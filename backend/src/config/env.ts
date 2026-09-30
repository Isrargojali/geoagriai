import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
// Load the monorepo root .env first (dev), then a backend-local .env if present.
for (const candidate of [
  path.resolve(here, '../../../.env'),
  path.resolve(here, '../../.env'),
]) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_PORT: z.coerce.number().int().default(4000),
  BACKEND_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(10).default('dev-only-access-secret'),
  JWT_REFRESH_SECRET: z.string().min(10).default('dev-only-refresh-secret'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  DATABASE_URL: z.string().default('file:../database/geoagri.db'),

  // 127.0.0.1 (not localhost): Node 18 fetch resolves localhost to ::1 first.
  PYTHON_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
  GIS_SERVICE_API_KEY: z.string().default('dev-internal-key'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('GeoAgri AI <no-reply@geoagri.ai>'),

  UPLOADS_DIR: z.string().default('../database/uploads'),
  REPORTS_DIR: z.string().default('../database/reports'),
  NDVI_DIR: z.string().default('../database/ndvi'),
  MAX_UPLOAD_MB: z.coerce.number().default(10),

  RATE_LIMIT_MAX: z.coerce.number().int().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Place/address search on the farm boundary map (OpenStreetMap Nominatim, no API key).
  GEOCODING_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

/** Resolve a possibly-relative storage dir against the backend package root. */
function resolveDir(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(here, '../..', p);
}

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  uploadsDir: resolveDir(raw.UPLOADS_DIR),
  reportsDir: resolveDir(raw.REPORTS_DIR),
  ndviDir: resolveDir(raw.NDVI_DIR),
};

export type Env = typeof env;

if (env.isProd) {
  const insecure: string[] = [];
  if (env.JWT_ACCESS_SECRET.startsWith('dev-only') || env.JWT_ACCESS_SECRET.startsWith('change-me')) {
    insecure.push('JWT_ACCESS_SECRET');
  }
  if (env.JWT_REFRESH_SECRET.startsWith('dev-only') || env.JWT_REFRESH_SECRET.startsWith('change-me')) {
    insecure.push('JWT_REFRESH_SECRET');
  }
  if (insecure.length > 0) {
    console.error(`Refusing to start in production with default secrets: ${insecure.join(', ')}`);
    process.exit(1);
  }
}
