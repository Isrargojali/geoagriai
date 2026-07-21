import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';

const fileParams = z.object({ fileName: z.string() });

/** Reject path-traversal attempts and resolve inside the given base dir. */
function safePath(baseDir: string, fileName: string): string {
  const resolved = path.resolve(baseDir, fileName);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
    throw new BadRequestError('Invalid file name');
  }
  return resolved;
}

function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Protected file access. Every file category enforces ownership:
 *  - NDVI overlays: owner of the analysis (or admin)
 *  - payment proofs: owner of the payment (or admin)
 *  - QR codes: public payment-instruction assets
 */
export async function fileRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/ndvi/:fileName',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['files'],
        summary: 'Download an NDVI overlay image',
        security: [{ bearerAuth: [] }],
        params: fileParams,
      },
    },
    async (request, reply) => {
      const filePath = safePath(env.ndviDir, request.params.fileName);
      const analysis = await prisma.analysis.findFirst({
        where: { ndviImagePath: filePath },
        select: { userId: true },
      });
      if (!analysis || !existsSync(filePath)) throw new NotFoundError('File');
      if (analysis.userId !== request.currentUser.id && request.currentUser.role !== 'ADMIN') {
        throw new ForbiddenError();
      }
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'private, max-age=86400')
        .send(createReadStream(filePath));
    },
  );

  r.get(
    '/uploads/:fileName',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['files'],
        summary: 'Download an uploaded file (payment proof screenshot)',
        security: [{ bearerAuth: [] }],
        params: fileParams,
      },
    },
    async (request, reply) => {
      const filePath = safePath(env.uploadsDir, request.params.fileName);
      if (!existsSync(filePath)) throw new NotFoundError('File');

      const proof = await prisma.paymentProof.findFirst({
        where: { screenshotPath: filePath },
        include: { payment: { select: { userId: true } } },
      });
      if (proof) {
        if (
          proof.payment.userId !== request.currentUser.id &&
          request.currentUser.role !== 'ADMIN'
        ) {
          throw new ForbiddenError();
        }
      } else if (request.currentUser.role !== 'ADMIN') {
        // Unclaimed uploads (e.g. QR codes) are admin-managed assets.
        const isQr = request.params.fileName.startsWith('qr-');
        if (!isQr) throw new ForbiddenError();
      }

      return reply
        .header('Content-Type', contentTypeFor(filePath))
        .header('Cache-Control', 'private, max-age=3600')
        .send(createReadStream(filePath));
    },
  );

  r.get(
    '/qr/:fileName',
    {
      schema: {
        tags: ['files'],
        summary: 'Public payment QR code image',
        params: fileParams,
      },
    },
    async (request, reply) => {
      if (!request.params.fileName.startsWith('qr-')) throw new NotFoundError('File');
      const filePath = safePath(env.uploadsDir, request.params.fileName);
      if (!existsSync(filePath)) throw new NotFoundError('File');
      return reply
        .header('Content-Type', contentTypeFor(filePath))
        .header('Cache-Control', 'public, max-age=3600')
        .send(createReadStream(filePath));
    },
  );
}
