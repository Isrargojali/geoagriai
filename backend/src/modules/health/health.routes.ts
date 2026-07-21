import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Service health check',
        response: {
          200: z.object({
            status: z.literal('ok'),
            database: z.enum(['up', 'down']),
            gisService: z.enum(['up', 'down']),
            timestamp: z.string(),
          }),
        },
      },
    },
    async () => {
      let database: 'up' | 'down' = 'up';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'down';
      }

      let gisService: 'up' | 'down' = 'down';
      try {
        const res = await fetch(`${env.PYTHON_SERVICE_URL}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        gisService = res.ok ? 'up' : 'down';
      } catch {
        gisService = 'down';
      }

      return {
        status: 'ok' as const,
        database,
        gisService,
        timestamp: new Date().toISOString(),
      };
    },
  );
}
