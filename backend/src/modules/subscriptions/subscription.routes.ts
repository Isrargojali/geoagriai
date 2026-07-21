import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { subscriptionDtoSchema, usageDtoSchema } from '../../schemas/dto.js';
import { getCurrentSubscription, toSubscriptionDto } from './subscription.service.js';
import { getUsage } from './usage.service.js';

export async function subscriptionRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['subscriptions'],
        summary: "Get the current user's subscription",
        security: [{ bearerAuth: [] }],
        response: { 200: subscriptionDtoSchema },
      },
    },
    async (request) => {
      const sub = await getCurrentSubscription(request.currentUser.id);
      return toSubscriptionDto(sub);
    },
  );

  r.get(
    '/usage',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['subscriptions'],
        summary: 'Get current usage against plan limits',
        security: [{ bearerAuth: [] }],
        response: { 200: usageDtoSchema },
      },
    },
    async (request) => getUsage(request.currentUser.id),
  );
}
