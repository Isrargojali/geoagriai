import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

/**
 * JWT authentication plugin.
 *  - Access tokens are short-lived JWTs signed with JWT_ACCESS_SECRET.
 *  - Refresh tokens are opaque random tokens stored hashed in the database
 *    (see auth.service.ts), which allows server-side revocation.
 */
export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  app.decorateRequest('currentUser', null as unknown as CurrentUser);

  app.decorate('authenticate', async (request: FastifyRequest) => {
    let payload: AccessTokenPayload;
    try {
      payload = await request.jwtVerify<AccessTokenPayload>();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Account is disabled or no longer exists');
    }

    request.currentUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    };
  });

  app.decorate('requireRole', (...roles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await app.authenticate(request, reply);
      if (!roles.includes(request.currentUser.role)) {
        throw new ForbiddenError();
      }
    };
  });
});
