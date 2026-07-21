import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

/** OpenAPI documentation, served at /docs (spec at /docs/json). */
export default fp(async (app) => {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'GeoAgri AI API',
        description:
          'REST API for GeoAgri AI — Smart Farming from Space. ' +
          'AI-powered GIS & Remote Sensing platform for crop health monitoring.',
        version: '1.0.0',
      },
      servers: [{ url: '/', description: 'Current server' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'health', description: 'Service health' },
        { name: 'auth', description: 'Authentication & account management' },
        { name: 'users', description: 'User profile' },
        { name: 'farms', description: 'Farm management & boundaries' },
        { name: 'analyses', description: 'Satellite NDVI analyses' },
        { name: 'weather', description: 'Weather & forecasts' },
        { name: 'reports', description: 'PDF/CSV report generation' },
        { name: 'notifications', description: 'User notifications' },
        { name: 'plans', description: 'Subscription plans' },
        { name: 'subscriptions', description: 'User subscription & usage' },
        { name: 'payments', description: 'Manual payment verification flow' },
        { name: 'settings', description: 'Public platform settings' },
        { name: 'files', description: 'Protected file access' },
        { name: 'admin', description: 'Admin operations' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  });
});
