import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

/** Seed the minimal reference data (roles + plans) every API test needs. */
export async function seedReferenceData(): Promise<void> {
  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrator' },
  });
  await prisma.role.upsert({
    where: { name: 'FARMER' },
    update: {},
    create: { name: 'FARMER', description: 'Farmer' },
  });
  await prisma.plan.upsert({
    where: { slug: 'trial' },
    update: {},
    create: {
      slug: 'trial',
      name: 'Free Trial',
      priceUsd: 0,
      billingPeriod: 'trial',
      maxFarms: 1,
      maxAnalysesPerDay: 5,
      maxAnalysesTotal: 30,
      featuresJson: '[]',
    },
  });
  await prisma.plan.upsert({
    where: { slug: 'starter' },
    update: {},
    create: {
      slug: 'starter',
      name: 'Starter',
      priceUsd: 9.99,
      billingPeriod: 'monthly',
      maxFarms: 3,
      maxAnalysesPerDay: 10,
      maxAnalysesTotal: null,
      featuresJson: '[]',
    },
  });
}

export async function createAdmin(email = 'admin@test.local'): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: await bcrypt.hash('Admin1234!', 4),
      firstName: 'Admin',
      lastName: 'User',
      roleId: role.id,
      emailVerified: true,
    },
  });
  return admin.id;
}

export const squareFarmGeometry = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [73.05, 31.4],
      [73.06, 31.4],
      [73.06, 31.41],
      [73.05, 31.41],
      [73.05, 31.4],
    ],
  ],
};
