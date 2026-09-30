import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { geoSearchResultSchema } from '../../schemas/dto.js';
import { searchPlaces } from './geo.service.js';

export async function geoRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/search',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['geo'],
        summary: 'Search place names / addresses to locate a farm on the map',
        security: [{ bearerAuth: [] }],
        querystring: z.object({ q: z.string().trim().min(2).max(200) }),
        response: { 200: z.array(geoSearchResultSchema) },
      },
    },
    async (request) => searchPlaces(request.query.q),
  );
}
