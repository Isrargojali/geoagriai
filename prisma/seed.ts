/**
 * Database seed: roles, subscription plans, default settings, and an initial
 * admin account. Idempotent — safe to run repeatedly.
 *
 * Run with: npm run db:seed -w @geoagri/backend
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@geoagri.ai';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!';

async function seedRoles() {
  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Platform administrator' },
  });
  await prisma.role.upsert({
    where: { name: 'FARMER' },
    update: {},
    create: { name: 'FARMER', description: 'Farmer / platform customer' },
  });
}

async function seedPlans() {
  const plans = [
    {
      slug: 'trial',
      name: 'Free Trial',
      priceUsd: 0,
      billingPeriod: 'trial',
      maxFarms: 1,
      maxAnalysesPerDay: 5,
      maxAnalysesTotal: 30,
      featuresJson: JSON.stringify([
        '14-day free trial',
        '1 farm',
        '5 analyses per day (30 total)',
        'NDVI crop health monitoring',
        'Weather & 7-day forecast',
      ]),
      isContactSales: false,
      isActive: true,
    },
    {
      slug: 'starter',
      name: 'Starter',
      priceUsd: 9.99,
      billingPeriod: 'monthly',
      maxFarms: 3,
      maxAnalysesPerDay: 10,
      maxAnalysesTotal: null,
      featuresJson: JSON.stringify([
        'Up to 3 farms',
        '10 analyses per day',
        'NDVI crop health monitoring',
        'AI recommendations',
        'PDF & CSV reports',
        'Email support',
      ]),
      isContactSales: false,
      isActive: true,
    },
    {
      slug: 'professional',
      name: 'Professional',
      priceUsd: 29.99,
      billingPeriod: 'monthly',
      maxFarms: 15,
      maxAnalysesPerDay: 50,
      maxAnalysesTotal: null,
      featuresJson: JSON.stringify([
        'Up to 15 farms',
        '50 analyses per day',
        'NDVI crop health monitoring',
        'AI recommendations',
        'Historical comparison',
        'PDF & CSV reports',
        'Priority support',
      ]),
      isContactSales: false,
      isActive: true,
    },
    {
      slug: 'enterprise',
      name: 'Enterprise',
      priceUsd: null,
      billingPeriod: 'custom',
      maxFarms: null,
      maxAnalysesPerDay: null,
      maxAnalysesTotal: null,
      featuresJson: JSON.stringify([
        'Unlimited farms',
        'Unlimited analyses',
        'Custom integrations',
        'Dedicated support',
        'Custom SLAs',
      ]),
      isContactSales: true,
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        priceUsd: plan.priceUsd,
        maxFarms: plan.maxFarms,
        maxAnalysesPerDay: plan.maxAnalysesPerDay,
        maxAnalysesTotal: plan.maxAnalysesTotal,
        featuresJson: plan.featuresJson,
        isContactSales: plan.isContactSales,
        isActive: plan.isActive,
      },
      create: plan,
    });
  }
}

async function seedSettings() {
  const settings: Array<{
    key: string;
    value: string;
    group: string;
    label: string;
    isPublic: boolean;
  }> = [
    { key: 'payment.jazzcash.number', value: '', group: 'payment', label: 'JazzCash Number', isPublic: true },
    { key: 'payment.jazzcash.accountTitle', value: '', group: 'payment', label: 'JazzCash Account Title', isPublic: true },
    { key: 'payment.jazzcash.qrCodePath', value: '', group: 'payment', label: 'JazzCash QR Code', isPublic: true },
    { key: 'payment.easypaisa.number', value: '', group: 'payment', label: 'EasyPaisa Number', isPublic: true },
    { key: 'payment.easypaisa.accountTitle', value: '', group: 'payment', label: 'EasyPaisa Account Title', isPublic: true },
    { key: 'payment.easypaisa.qrCodePath', value: '', group: 'payment', label: 'EasyPaisa QR Code', isPublic: true },
    { key: 'payment.bank.name', value: '', group: 'payment', label: 'Bank Name', isPublic: true },
    { key: 'payment.bank.branch', value: '', group: 'payment', label: 'Bank Branch', isPublic: true },
    { key: 'payment.bank.accountTitle', value: '', group: 'payment', label: 'Bank Account Title', isPublic: true },
    { key: 'payment.bank.accountNumber', value: '', group: 'payment', label: 'Bank Account Number', isPublic: true },
    { key: 'payment.bank.iban', value: '', group: 'payment', label: 'IBAN', isPublic: true },
    { key: 'payment.bank.swiftCode', value: '', group: 'payment', label: 'SWIFT Code', isPublic: true },
    { key: 'support.email', value: 'support@geoagri.ai', group: 'support', label: 'Support Email', isPublic: true },
    { key: 'support.whatsapp', value: '', group: 'support', label: 'Support WhatsApp', isPublic: true },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { group: s.group, label: s.label, isPublic: s.isPublic },
      create: s,
    });
  }
}

async function seedAdmin() {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) return;

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      firstName: 'Platform',
      lastName: 'Admin',
      roleId: adminRole.id,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`Seeded admin account: ${ADMIN_EMAIL} (change the password immediately)`);
}

async function main() {
  await seedRoles();
  await seedPlans();
  await seedSettings();
  await seedAdmin();
  console.log('Seed completed.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
