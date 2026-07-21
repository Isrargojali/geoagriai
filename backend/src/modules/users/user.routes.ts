import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { AUDIT_ACTIONS, changePasswordSchema, updateProfileSchema } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { NotFoundError } from '../../lib/errors.js';
import { messageSchema, userDtoSchema } from '../../schemas/dto.js';
import { changePassword, toUserDto } from '../auth/auth.service.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Get the current user profile',
        security: [{ bearerAuth: [] }],
        response: { 200: userDtoSchema },
      },
    },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.currentUser.id },
        include: { role: true },
      });
      if (!user) throw new NotFoundError('User');
      return toUserDto(user);
    },
  );

  r.patch(
    '/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['users'],
        summary: 'Update the current user profile',
        security: [{ bearerAuth: [] }],
        body: updateProfileSchema,
        response: { 200: userDtoSchema },
      },
    },
    async (request) => {
      const user = await prisma.user.update({
        where: { id: request.currentUser.id },
        data: {
          firstName: request.body.firstName,
          lastName: request.body.lastName,
          phone: request.body.phone,
        },
        include: { role: true },
      });
      await audit({
        userId: user.id,
        action: AUDIT_ACTIONS.USER_UPDATED,
        resource: 'user',
        resourceId: user.id,
        ipAddress: request.ip,
      });
      return toUserDto(user);
    },
  );

  r.post(
    '/me/change-password',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        tags: ['users'],
        summary: 'Change the current user password',
        security: [{ bearerAuth: [] }],
        body: changePasswordSchema,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await changePassword(
        request.currentUser.id,
        request.body.currentPassword,
        request.body.newPassword,
      );
      return { message: 'Password changed successfully' };
    },
  );
}
