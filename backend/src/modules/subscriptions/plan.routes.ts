import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { planDtoSchema } from '../../schemas/dto.js';
import { listActivePlans } from './subscription.service.js';

export async function planRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      schema: {
        tags: ['plans'],
        summary: 'List purchasable subscription plans',
        response: { 200: z.array(planDtoSchema) },
      },
    },
    async () => listActivePlans(),
  );
}
