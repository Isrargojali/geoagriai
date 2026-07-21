import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/** Singleton Prisma client shared across the app. */
export const prisma = new PrismaClient({
  log: env.isProd ? ['error', 'warn'] : ['error', 'warn'],
});
