import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { weatherDtoSchema } from '../../schemas/dto.js';
import { getFarmWeather } from './weather.service.js';

export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/farms/:farmId/weather',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['weather'],
        summary: 'Current weather + 7-day forecast at the farm centroid',
        security: [{ bearerAuth: [] }],
        params: z.object({ farmId: z.string() }),
        response: { 200: weatherDtoSchema },
      },
    },
    async (request) => getFarmWeather(request.currentUser.id, request.params.farmId),
  );
}
