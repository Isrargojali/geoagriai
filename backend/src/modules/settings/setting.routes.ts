import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { settingDtoSchema } from '../../schemas/dto.js';
import { getPublicSettings } from './setting.service.js';

export async function settingRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/public',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['settings'],
        summary: 'Public platform settings (payment instructions, support contacts)',
        security: [{ bearerAuth: [] }],
        response: { 200: z.array(settingDtoSchema) },
      },
    },
    async () => getPublicSettings(),
  );
}
