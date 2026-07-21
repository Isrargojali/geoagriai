import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { messageSchema, notificationDtoSchema } from '../../schemas/dto.js';
import * as notificationService from './notification.service.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'List recent notifications',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          unreadOnly: z.coerce.boolean().default(false),
        }),
        response: { 200: z.array(notificationDtoSchema) },
      },
    },
    async (request) =>
      notificationService.listNotifications(request.currentUser.id, request.query.unreadOnly),
  );

  r.post(
    '/:notificationId/read',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Mark a notification as read',
        security: [{ bearerAuth: [] }],
        params: z.object({ notificationId: z.string() }),
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await notificationService.markRead(request.currentUser.id, request.params.notificationId);
      return { message: 'Marked as read' };
    },
  );

  r.post(
    '/read-all',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['notifications'],
        summary: 'Mark all notifications as read',
        security: [{ bearerAuth: [] }],
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await notificationService.markAllRead(request.currentUser.id);
      return { message: 'All notifications marked as read' };
    },
  );
}
