import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { seedReferenceData, squareFarmGeometry } from './helpers.js';

describe('farms API', () => {
  let app: App;
  let token = '';
  let otherToken = '';
  let farmId = '';

  beforeAll(async () => {
    await seedReferenceData();
    app = await buildApp();

    for (const [i, ref] of ['owner', 'other'].entries()) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `farm-${ref}-${Date.now()}@test.local`,
          password: 'Password1!',
          firstName: 'Farm',
          lastName: `User${i}`,
        },
      });
      if (ref === 'owner') token = res.json().tokens.accessToken;
      else otherToken = res.json().tokens.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('creates a farm from a drawn polygon and calculates its area', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/farms',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test Farm', cropType: 'wheat', geometry: squareFarmGeometry },
    });
    expect(res.statusCode).toBe(201);
    const farm = res.json();
    farmId = farm.id;
    expect(farm.areaHectares).toBeGreaterThan(90);
    expect(farm.boundary.geometry.type).toBe('Polygon');
    expect(farm.boundary.source).toBe('DRAWN');
  });

  it('enforces the trial farm limit (1 farm)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/farms',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Second Farm', geometry: squareFarmGeometry },
    });
    expect(res.statusCode).toBe(402);
    expect(res.json().error).toBe('LIMIT_EXCEEDED');
  });

  it('lists only the owner’s farms', async () => {
    const mine = await app.inject({
      method: 'GET',
      url: '/api/v1/farms',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mine.json()).toHaveLength(1);

    const theirs = await app.inject({
      method: 'GET',
      url: '/api/v1/farms',
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(theirs.json()).toHaveLength(0);
  });

  it('prevents access to another user’s farm', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/farms/${farmId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('creates a farm from an uploaded GeoJSON file', async () => {
    const boundary = JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: squareFarmGeometry,
    });
    const form = new FormData();
    form.append('name', 'Uploaded Farm');
    form.append('file', new Blob([boundary], { type: 'application/geo+json' }), 'field.geojson');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/farms/upload',
      headers: { authorization: `Bearer ${otherToken}` },
      body: form,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().boundary.source).toBe('GEOJSON');
  });

  it('updates farm metadata', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/farms/${farmId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Renamed Farm', cropType: 'cotton' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Renamed Farm');
    expect(res.json().cropType).toBe('cotton');
  });

  it('reports usage against plan limits', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription/usage',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const usage = res.json();
    expect(usage.farms).toEqual({ used: 1, limit: 1 });
    expect(usage.canCreateFarm).toBe(false);
    expect(usage.canRunAnalysis).toBe(true);
  });

  it('deletes a farm and cascades its data', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/farms/${farmId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const gone = await prisma.farm.findUnique({ where: { id: farmId } });
    expect(gone).toBeNull();
  });
});
