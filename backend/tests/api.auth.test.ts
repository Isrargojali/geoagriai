import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { seedReferenceData } from './helpers.js';

describe('auth API', () => {
  let app: App;
  const email = `auth-${Date.now()}@test.local`;
  const password = 'Password1!';
  let refreshToken = '';

  beforeAll(async () => {
    await seedReferenceData();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registers a new user with a 14-day trial', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, firstName: 'Api', lastName: 'Tester' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('FARMER');
    expect(body.tokens.accessToken).toBeTruthy();

    const sub = await prisma.subscription.findFirst({
      where: { user: { email } },
      include: { plan: true },
    });
    expect(sub?.status).toBe('TRIAL');
    expect(sub?.plan.slug).toBe('trial');
    expect(sub?.trialEndsAt).toBeTruthy();
  });

  it('rejects duplicate registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, password, firstName: 'Api', lastName: 'Tester' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects weak passwords with validation details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email: 'weak@test.local', password: 'short', firstName: 'A', lastName: 'B' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('logs in with valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    refreshToken = res.json().tokens.refreshToken;
  });

  it('rejects invalid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'WrongPass1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rotates refresh tokens and revokes the old one', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(first.statusCode).toBe(200);

    // The old token must now be unusable.
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('requires authentication for the profile endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the profile with a valid token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    const token = login.json().tokens.accessToken;
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe(email);
  });
});
