import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { paginationSchema, requestAnalysisSchema } from '@geoagri/shared';
import { analysisDtoSchema, paginatedSchema } from '../../schemas/dto.js';
import * as analysisService from './analysis.service.js';

const farmIdParams = z.object({ farmId: z.string() });
const analysisIdParams = z.object({ analysisId: z.string() });

const historyPointSchema = z.object({
  id: z.string(),
  date: z.string(),
  ndviMean: z.number(),
  ndviMin: z.number().nullable(),
  ndviMax: z.number().nullable(),
  healthScore: z.number().nullable(),
  healthStatus: z.string().nullable(),
});

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/farms/:farmId/analyses',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
      schema: {
        tags: ['analyses'],
        summary: 'Run a new NDVI analysis for a farm',
        description:
          'Sends the farm boundary to the GIS service, retrieves Sentinel-2 ' +
          'imagery, computes NDVI, fetches weather, and generates an AI ' +
          'recommendation. Subject to plan limits.',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        body: requestAnalysisSchema,
        response: { 201: analysisDtoSchema },
      },
    },
    async (request, reply) => {
      const result = await analysisService.runAnalysis(
        request.currentUser.id,
        request.params.farmId,
        { endDate: request.body.endDate, windowDays: request.body.windowDays },
        request.ip,
        request.currentUser.role,
      );
      return reply.status(201).send(result);
    },
  );

  r.get(
    '/farms/:farmId/analyses',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['analyses'],
        summary: 'List analyses for a farm (paginated, newest first)',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        querystring: paginationSchema,
        response: { 200: paginatedSchema(analysisDtoSchema) },
      },
    },
    async (request) =>
      analysisService.listAnalyses(
        request.currentUser.id,
        request.params.farmId,
        request.query.page,
        request.query.pageSize,
      ),
  );

  r.get(
    '/farms/:farmId/analyses/history',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['analyses'],
        summary: 'NDVI time series for charts (completed analyses only)',
        security: [{ bearerAuth: [] }],
        params: farmIdParams,
        response: { 200: z.array(historyPointSchema) },
      },
    },
    async (request) =>
      analysisService.getAnalysisHistory(request.currentUser.id, request.params.farmId),
  );

  r.get(
    '/analyses/:analysisId',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['analyses'],
        summary: 'Get a single analysis with statistics, weather and AI recommendation',
        security: [{ bearerAuth: [] }],
        params: analysisIdParams,
        response: { 200: analysisDtoSchema },
      },
    },
    async (request) =>
      analysisService.getAnalysis(request.currentUser.id, request.params.analysisId),
  );
}
