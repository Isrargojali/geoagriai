import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type App } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createAdmin, seedReferenceData } from './helpers.js';

describe('manual payments API', () => {
  let app: App;
  let farmerToken = '';
  let adminToken = '';
  let starterPlanId = '';
  let paymentId = '';

  beforeAll(async () => {
    await seedReferenceData();
    await createAdmin('payments-admin@test.local');
    app = await buildApp();

    const farmer = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: `payer-${Date.now()}@test.local`,
        password: 'Password1!',
        firstName: 'Paying',
        lastName: 'Farmer',
      },
    });
    farmerToken = farmer.json().tokens.accessToken;

    const admin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'payments-admin@test.local', password: 'Admin1234!' },
    });
    adminToken = admin.json().tokens.accessToken;

    const starter = await prisma.plan.findUniqueOrThrow({ where: { slug: 'starter' } });
    starterPlanId = starter.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('starts a manual payment and returns instructions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { planId: starterPlanId, method: 'JAZZCASH' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    paymentId = body.payment.id;
    expect(body.payment.status).toBe('PENDING');
    expect(body.payment.amountUsd).toBeCloseTo(9.99);
    expect(body.instructions.method).toBe('JAZZCASH');
  });

  it('blocks a second concurrent pending payment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments',
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { planId: starterPlanId, method: 'EASYPAISA' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('refuses approval before proof is uploaded', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/payments/${paymentId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts payment proof with a screenshot', async () => {
    // Minimal 1x1 transparent PNG.
    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('transactionId', 'TX-123456789');
    form.append('amount', '9.99');
    form.append('paymentDate', '2026-07-18');
    form.append('method', 'JAZZCASH');
    form.append('notes', 'Paid via JazzCash app');
    form.append('screenshot', new Blob([pngBytes], { type: 'image/png' }), 'proof.png');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/${paymentId}/proof`,
      headers: { authorization: `Bearer ${farmerToken}` },
      body: form,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().proof.transactionId).toBe('TX-123456789');
  });

  it('blocks non-admins from approving payments', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/payments/${paymentId}/approve`,
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('approves the payment, activates the subscription and issues an invoice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/payments/${paymentId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('APPROVED');

    const subRes = await app.inject({
      method: 'GET',
      url: '/api/v1/subscription',
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    const sub = subRes.json();
    expect(sub.status).toBe('ACTIVE');
    expect(sub.plan.slug).toBe('starter');

    const invoices = await app.inject({
      method: 'GET',
      url: '/api/v1/payments/invoices',
      headers: { authorization: `Bearer ${farmerToken}` },
    });
    expect(invoices.json()).toHaveLength(1);
    expect(invoices.json()[0].invoiceNumber).toMatch(/^GA-\d{4}-\d{6}$/);
  });

  it('audit-logs the approval', async () => {
    const log = await prisma.auditLog.findFirst({
      where: { action: 'PAYMENT_APPROVED', resourceId: paymentId },
    });
    expect(log).not.toBeNull();
  });
});
