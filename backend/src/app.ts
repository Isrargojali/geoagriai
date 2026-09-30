import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { AppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { farmRoutes } from './modules/farms/farm.routes.js';
import { analysisRoutes } from './modules/analyses/analysis.routes.js';
import { weatherRoutes } from './modules/weather/weather.routes.js';
import { geoRoutes } from './modules/geo/geo.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { planRoutes } from './modules/subscriptions/plan.routes.js';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes.js';
import { paymentRoutes } from './modules/payments/payment.routes.js';
import { settingRoutes } from './modules/settings/setting.routes.js';
import { fileRoutes } from './modules/files/file.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';

export type App = FastifyInstance;

export async function buildApp(): Promise<App> {
  const app = Fastify({
    logger: env.isTest
      ? false
      : {
          level: env.isProd ? 'info' : 'debug',
          transport: env.isProd ? undefined : { target: 'pino-pretty' },
        },
    trustProxy: true,
    bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ---------- Security ----------
  await app.register(helmet, {
    // The API serves images (NDVI overlays, QR codes) consumed by the SPA.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: env.isTest ? () => true : undefined,
  });
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  });

  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  // ---------- Error handling ----------
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.code,
        message: error.message,
        details: error.details,
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.flatten().fieldErrors,
      });
    }
    // Fastify validation / rate-limit / multipart errors carry statusCode
    const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
    return reply.status(statusCode).send({
      statusCode,
      error: error.code ?? 'REQUEST_ERROR',
      message: error.message,
    });
  });

  // ---------- Routes ----------
  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(farmRoutes, { prefix: '/farms' });
      await api.register(analysisRoutes);
      await api.register(weatherRoutes);
      await api.register(geoRoutes, { prefix: '/geo' });
      await api.register(reportRoutes, { prefix: '/reports' });
      await api.register(notificationRoutes, { prefix: '/notifications' });
      await api.register(planRoutes, { prefix: '/plans' });
      await api.register(subscriptionRoutes, { prefix: '/subscription' });
      await api.register(paymentRoutes, { prefix: '/payments' });
      await api.register(settingRoutes, { prefix: '/settings' });
      await api.register(fileRoutes, { prefix: '/files' });
      await api.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: '/api/v1' },
  );

  return app;
}
