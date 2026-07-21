import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  paginationSchema,
  rejectPaymentSchema,
  updateSettingsSchema,
  updateUserAdminSchema,
  upsertPlanSchema,
} from '@geoagri/shared';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../lib/errors.js';
import {
  paginatedSchema,
  paymentDtoSchema,
  planDtoSchema,
  settingDtoSchema,
  subscriptionDtoSchema,
  userDtoSchema,
} from '../../schemas/dto.js';
import * as adminService from './admin.service.js';
import * as paymentService from '../payments/payment.service.js';
import { getAllSettings, updateSettings } from '../settings/setting.service.js';

const ownerSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });

const adminFarmSchema = z.object({
  id: z.string(),
  name: z.string(),
  areaHectares: z.number(),
  cropType: z.string().nullable(),
  centroidLat: z.number(),
  centroidLng: z.number(),
  analysisCount: z.number(),
  owner: ownerSchema,
  createdAt: z.string(),
});

const adminUserSchema = userDtoSchema.extend({
  farmCount: z.number(),
  subscription: subscriptionDtoSchema.nullable(),
});

const analyticsSchema = z.object({
  totalUsers: z.number(),
  activeSubscriptions: z.number(),
  trialUsers: z.number(),
  totalFarms: z.number(),
  totalAnalyses: z.number(),
  pendingPayments: z.number(),
  revenueUsd: z.number(),
  usersLast30Days: z.array(z.object({ date: z.string(), count: z.number() })),
  analysesLast30Days: z.array(z.object({ date: z.string(), count: z.number() })),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const adminOnly = { onRequest: [app.requireRole('ADMIN')] };

  // ---------- Analytics ----------
  r.get(
    '/analytics',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Platform analytics overview',
        security: [{ bearerAuth: [] }],
        response: { 200: analyticsSchema },
      },
    },
    async () => adminService.getAnalytics(),
  );

  // ---------- Users ----------
  r.get(
    '/users',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List users',
        security: [{ bearerAuth: [] }],
        querystring: paginationSchema.extend({ search: z.string().optional() }),
        response: { 200: paginatedSchema(adminUserSchema) },
      },
    },
    async (request) =>
      adminService.listUsers(request.query.page, request.query.pageSize, request.query.search),
  );

  r.patch(
    '/users/:userId',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Update a user (activate/deactivate, role, email verification)',
        security: [{ bearerAuth: [] }],
        params: z.object({ userId: z.string() }),
        body: updateUserAdminSchema,
        response: { 200: userDtoSchema },
      },
    },
    async (request) =>
      adminService.updateUser(
        request.currentUser.id,
        request.params.userId,
        request.body,
        request.ip,
      ),
  );

  // ---------- Farms ----------
  r.get(
    '/farms',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List all farms across the platform',
        security: [{ bearerAuth: [] }],
        querystring: paginationSchema,
        response: { 200: paginatedSchema(adminFarmSchema) },
      },
    },
    async (request) => adminService.listAllFarms(request.query.page, request.query.pageSize),
  );

  // ---------- Payments ----------
  r.get(
    '/payments',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List payments (filter by status)',
        security: [{ bearerAuth: [] }],
        querystring: paginationSchema.extend({
          status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        }),
        response: { 200: paginatedSchema(paymentDtoSchema.extend({ user: ownerSchema })) },
      },
    },
    async (request) =>
      adminService.listPayments(request.query.status, request.query.page, request.query.pageSize),
  );

  r.post(
    '/payments/:paymentId/approve',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Approve a payment (activates subscription + generates invoice)',
        security: [{ bearerAuth: [] }],
        params: z.object({ paymentId: z.string() }),
        response: { 200: paymentDtoSchema },
      },
    },
    async (request) =>
      paymentService.approvePayment(request.currentUser.id, request.params.paymentId, request.ip),
  );

  r.post(
    '/payments/:paymentId/reject',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Reject a payment with a reason',
        security: [{ bearerAuth: [] }],
        params: z.object({ paymentId: z.string() }),
        body: rejectPaymentSchema,
        response: { 200: paymentDtoSchema },
      },
    },
    async (request) =>
      paymentService.rejectPayment(
        request.currentUser.id,
        request.params.paymentId,
        request.body.reason,
        request.ip,
      ),
  );

  // ---------- Subscriptions ----------
  r.get(
    '/subscriptions',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List subscriptions',
        security: [{ bearerAuth: [] }],
        querystring: paginationSchema,
        response: {
          200: paginatedSchema(subscriptionDtoSchema.extend({ user: ownerSchema })),
        },
      },
    },
    async (request) =>
      adminService.listSubscriptions(request.query.page, request.query.pageSize),
  );

  r.post(
    '/subscriptions/:subscriptionId/cancel',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Cancel a subscription',
        security: [{ bearerAuth: [] }],
        params: z.object({ subscriptionId: z.string() }),
        response: { 200: subscriptionDtoSchema },
      },
    },
    async (request) =>
      adminService.cancelSubscription(
        request.currentUser.id,
        request.params.subscriptionId,
        request.ip,
      ),
  );

  // ---------- Plans ----------
  r.get(
    '/plans',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List all plans including inactive and trial',
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(planDtoSchema) },
      },
    },
    async () => adminService.listAllPlans(),
  );

  r.put(
    '/plans/:planId',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Update a plan',
        security: [{ bearerAuth: [] }],
        params: z.object({ planId: z.string() }),
        body: upsertPlanSchema,
        response: { 200: planDtoSchema },
      },
    },
    async (request) =>
      adminService.updatePlan(
        request.currentUser.id,
        request.params.planId,
        request.body,
        request.ip,
      ),
  );

  // ---------- Settings ----------
  r.get(
    '/settings',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'List all platform settings',
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(settingDtoSchema) },
      },
    },
    async () => getAllSettings(),
  );

  r.put(
    '/settings',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Update platform settings (payment accounts, support contacts)',
        security: [{ bearerAuth: [] }],
        body: updateSettingsSchema,
        response: { 200: z.array(settingDtoSchema) },
      },
    },
    async (request) =>
      updateSettings(request.currentUser.id, request.body.settings, request.ip),
  );

  r.post(
    '/settings/qr/:settingKey',
    {
      ...adminOnly,
      schema: {
        tags: ['admin'],
        summary: 'Upload a QR code image for a payment method setting',
        description:
          'Multipart upload. settingKey must be a *.qrCodePath setting. The stored ' +
          'value is the served file name.',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({ settingKey: z.string() }),
        response: { 200: z.array(settingDtoSchema) },
      },
    },
    async (request) => {
      if (!request.params.settingKey.endsWith('.qrCodePath')) {
        throw new BadRequestError('settingKey must be a QR code setting');
      }
      const file = await request.file();
      if (!file) throw new BadRequestError('A QR code image is required');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
        throw new BadRequestError('QR code must be a PNG, JPEG or WebP image');
      }
      const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `qr-${randomUUID().slice(0, 12)}.${ext}`;
      await writeFile(path.join(env.uploadsDir, fileName), await file.toBuffer());
      return updateSettings(
        request.currentUser.id,
        [{ key: request.params.settingKey, value: fileName }],
        request.ip,
      );
    },
  );
}
