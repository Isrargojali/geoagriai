import { mkdirSync } from 'node:fs';
import { buildApp } from './app.js';
import { env } from './config/env.js';

// Ensure storage directories exist before the app starts serving.
for (const dir of [env.uploadsDir, env.reportsDir, env.ndviDir]) {
  mkdirSync(dir, { recursive: true });
}

const app = await buildApp();

try {
  await app.listen({ port: env.BACKEND_PORT, host: env.BACKEND_HOST });
  app.log.info(`GeoAgri AI API listening on ${env.BACKEND_HOST}:${env.BACKEND_PORT}`);
  app.log.info(`OpenAPI docs available at http://localhost:${env.BACKEND_PORT}/docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  });
}
