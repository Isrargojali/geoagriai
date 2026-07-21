import { createReadStream, existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';
import { reportDtoSchema } from '../../schemas/dto.js';
import * as reportService from './report.service.js';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/farms/:farmId',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '10 minutes' } },
      schema: {
        tags: ['reports'],
        summary: 'Generate a PDF or CSV report for a farm',
        security: [{ bearerAuth: [] }],
        params: z.object({ farmId: z.string() }),
        body: z.object({
          type: z.enum(['PDF', 'CSV']),
          analysisId: z.string().optional(),
        }),
        response: { 201: reportDtoSchema },
      },
    },
    async (request, reply) => {
      const report = await reportService.createReport(
        request.currentUser.id,
        request.params.farmId,
        request.body.type,
        request.body.analysisId,
        request.ip,
      );
      return reply.status(201).send(report);
    },
  );

  r.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['reports'],
        summary: "List the current user's generated reports",
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(reportDtoSchema) },
      },
    },
    async (request) => reportService.listReports(request.currentUser.id),
  );

  r.get(
    '/:reportId/download',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['reports'],
        summary: 'Download a generated report',
        security: [{ bearerAuth: [] }],
        params: z.object({ reportId: z.string() }),
      },
    },
    async (request, reply) => {
      const file = await reportService.getReportFile(
        request.currentUser.id,
        request.params.reportId,
      );
      if (!existsSync(file.filePath)) throw new NotFoundError('Report file');
      return reply
        .header('Content-Type', file.contentType)
        .header('Content-Disposition', `attachment; filename="${file.fileName}"`)
        .send(createReadStream(file.filePath));
    },
  );
}
