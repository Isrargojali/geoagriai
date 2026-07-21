import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@geoagri/shared';
import * as authService from './auth.service.js';
import { authResponseSchema, messageSchema } from '../../schemas/dto.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/register',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        summary: 'Register a new account (starts a 14-day free trial)',
        body: registerSchema,
        response: { 201: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.register(app, {
        ...request.body,
        ipAddress: request.ip,
      });
      return reply.status(201).send(result);
    },
  );

  r.post(
    '/login',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Log in with email and password',
        body: loginSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) =>
      authService.login(app, request.body.email, request.body.password, request.ip),
  );

  r.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Exchange a refresh token for a new token pair',
        body: refreshSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request) => authService.refresh(app, request.body.refreshToken),
  );

  r.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a refresh token',
        body: refreshSchema,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await authService.logout(request.body.refreshToken);
      return { message: 'Logged out' };
    },
  );

  r.post(
    '/verify-email',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify email address using the emailed token',
        body: verifyEmailSchema,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await authService.verifyEmail(request.body.token, request.ip);
      return { message: 'Email verified successfully' };
    },
  );

  r.post(
    '/resend-verification',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        summary: 'Resend the email verification link',
        security: [{ bearerAuth: [] }],
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await authService.resendVerification(request.currentUser.id);
      return { message: 'Verification email sent' };
    },
  );

  r.post(
    '/forgot-password',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
      schema: {
        tags: ['auth'],
        summary: 'Request a password reset email',
        body: forgotPasswordSchema,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await authService.forgotPassword(request.body.email, request.ip);
      return { message: 'If that email is registered, a reset link has been sent' };
    },
  );

  r.post(
    '/reset-password',
    {
      schema: {
        tags: ['auth'],
        summary: 'Reset password using the emailed token',
        body: resetPasswordSchema,
        response: { 200: messageSchema },
      },
    },
    async (request) => {
      await authService.resetPassword(request.body.token, request.body.password, request.ip);
      return { message: 'Password reset successfully. You can now log in.' };
    },
  );
}
