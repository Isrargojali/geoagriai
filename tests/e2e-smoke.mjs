#!/usr/bin/env node
/**
 * GeoAgri AI — full-stack end-to-end smoke test.
 *
 * Exercises the complete user workflow against a RUNNING stack
 * (local dev servers or docker compose):
 *   register → farm creation → NDVI analysis → weather → report → billing.
 *
 * Usage:
 *   node tests/e2e-smoke.mjs [apiBaseUrl]
 * Default apiBaseUrl: http://localhost:4000/api/v1
 */

// 127.0.0.1 (not localhost) — Node 18 fetch prefers IPv6 ::1 for localhost,
// while the API binds IPv4.
const BASE = process.argv[2] ?? 'http://127.0.0.1:4000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function api(path, { method = 'GET', token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // binary/no-body responses
  }
  return { status: res.status, json };
}

const geometry = {
  type: 'Polygon',
  coordinates: [
    [
      [73.05, 31.4],
      [73.06, 31.4],
      [73.06, 31.41],
      [73.05, 31.41],
      [73.05, 31.4],
    ],
  ],
};

console.log(`GeoAgri AI E2E smoke test → ${BASE}\n`);

// 1. Health
console.log('Health');
const health = await api('/health');
assert(health.status === 200 && health.json.status === 'ok', 'API is healthy');
assert(health.json.database === 'up', 'database is up');
assert(health.json.gisService === 'up', 'GIS service is up');

// 2. Register
console.log('Auth');
const email = `e2e-${Date.now()}@smoke.test`;
const registered = await api('/auth/register', {
  method: 'POST',
  body: { email, password: 'Password1!', firstName: 'Smoke', lastName: 'Test' },
});
assert(registered.status === 201, 'user registration succeeds');
const token = registered.json?.tokens?.accessToken;
assert(Boolean(token), 'access token issued');

const sub = await api('/subscription', { token });
assert(sub.json?.status === 'TRIAL', '14-day trial started');

// 3. Farm creation
console.log('Farms');
const farm = await api('/farms', {
  method: 'POST',
  token,
  body: { name: 'E2E Smoke Farm', cropType: 'wheat', geometry },
});
assert(farm.status === 201, 'farm created from polygon');
assert(farm.json?.areaHectares > 50, `area calculated (${farm.json?.areaHectares} ha)`);

// 4. NDVI analysis (GIS → AI pipeline)
console.log('Analysis (may take up to 2 minutes)');
const analysis = await api(`/farms/${farm.json.id}/analyses`, {
  method: 'POST',
  token,
  body: {},
});
assert(analysis.status === 201, 'analysis request accepted');
assert(analysis.json?.status === 'COMPLETED', `analysis completed (${analysis.json?.status})`);
assert(
  typeof analysis.json?.ndviMean === 'number' && analysis.json.ndviMean >= -1,
  `NDVI computed (mean ${analysis.json?.ndviMean})`,
);
assert(
  typeof analysis.json?.healthScore === 'number',
  `health score generated (${analysis.json?.healthScore}/100)`,
);
assert(
  (analysis.json?.recommendation?.reasons?.length ?? 0) > 0,
  'AI recommendation includes reasons (explainability)',
);
assert(Boolean(analysis.json?.ndviImageUrl), 'NDVI overlay image stored');

// 5. Weather
console.log('Weather');
const weather = await api(`/farms/${farm.json.id}/weather`, { token });
assert(weather.status === 200, 'weather retrieved');
assert((weather.json?.forecast?.length ?? 0) === 7, '7-day forecast present');

// 6. Reports
console.log('Reports');
const pdf = await api(`/reports/farms/${farm.json.id}`, {
  method: 'POST',
  token,
  body: { type: 'PDF' },
});
assert(pdf.status === 201, 'PDF report generated');
const csv = await api(`/reports/farms/${farm.json.id}`, {
  method: 'POST',
  token,
  body: { type: 'CSV' },
});
assert(csv.status === 201, 'CSV report generated');

// 7. Billing
console.log('Billing');
const plans = await api('/plans');
assert(plans.status === 200 && plans.json.length >= 3, 'plans listed');
const starter = plans.json.find((p) => p.slug === 'starter');
const payment = await api('/payments', {
  method: 'POST',
  token,
  body: { planId: starter.id, method: 'BANK_TRANSFER' },
});
assert(payment.status === 201, 'manual payment initiated');
assert(payment.json?.instructions !== undefined, 'payment instructions returned');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
