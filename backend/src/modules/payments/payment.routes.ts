import { createReadStream } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createPaymentSchema, paymentMethodSchema, submitProofSchema } from '@geoagri/shared';
import { BadRequestError } from '../../lib/errors.js';
import {
  invoiceDtoSchema,
  paymentDtoSchema,
  paymentInstructionsSchema,
} from '../../schemas/dto.js';
import { manualProvider } from './providers/index.js';
import * as paymentService from './payment.service.js';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/instructions/:method',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Payment instructions for a method (JazzCash / EasyPaisa / bank transfer)',
        security: [{ bearerAuth: [] }],
        params: z.object({ method: paymentMethodSchema }),
        response: { 200: paymentInstructionsSchema },
      },
    },
    async (request) => manualProvider.getInstructions(request.params.method),
  );

  r.post(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Start a payment for a plan (manual verification flow)',
        security: [{ bearerAuth: [] }],
        body: createPaymentSchema,
        response: {
          201: z.object({
            payment: paymentDtoSchema,
            instructions: paymentInstructionsSchema.nullable(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await paymentService.createPayment(
        request.currentUser.id,
        request.body.planId,
        request.body.method,
        request.ip,
      );
      return reply.status(201).send(result);
    },
  );

  r.post(
    '/:paymentId/proof',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Upload payment proof (multipart: screenshot + transaction details)',
        description:
          'Multipart form fields: transactionId, amount, paymentDate (YYYY-MM-DD), ' +
          'method, notes (optional), screenshot (image file).',
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
        params: z.object({ paymentId: z.string() }),
        response: { 200: paymentDtoSchema },
      },
    },
    async (request) => {
      const parts = request.parts();
      const fields: Record<string, string> = {};
      let screenshot: { buffer: Buffer; mimetype: string } | null = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          screenshot = { buffer: await part.toBuffer(), mimetype: part.mimetype };
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!screenshot) throw new BadRequestError('A payment screenshot is required');
      const input = submitProofSchema.parse(fields);

      return paymentService.submitProof(
        request.currentUser.id,
        request.params.paymentId,
        input,
        screenshot,
        request.ip,
      );
    },
  );

  r.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: "List the current user's payments",
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(paymentDtoSchema) },
      },
    },
    async (request) => paymentService.listMyPayments(request.currentUser.id),
  );

  r.get(
    '/invoices',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: "List the current user's invoices",
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(invoiceDtoSchema) },
      },
    },
    async (request) => paymentService.listMyInvoices(request.currentUser.id),
  );

  r.get(
    '/invoices/:invoiceId/download',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['payments'],
        summary: 'Download an invoice PDF',
        security: [{ bearerAuth: [] }],
        params: z.object({ invoiceId: z.string() }),
      },
    },
    async (request, reply) => {
      const pdfPath = await paymentService.getInvoicePdfPath(
        request.currentUser.id,
        request.params.invoiceId,
        request.currentUser.role === 'ADMIN',
      );
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${path.basename(pdfPath)}"`)
        .send(createReadStream(pdfPath));
    },
  );
}
