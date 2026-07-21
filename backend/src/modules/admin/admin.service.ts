import {
  AUDIT_ACTIONS,
  type AdminAnalyticsDto,
  type PlanDto,
  type UpsertPlanInput,
} from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { toJson } from '../../lib/json.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { toUserDto } from '../auth/auth.service.js';
import { toPlanDto, toSubscriptionDto } from '../subscriptions/subscription.service.js';
import { toPaymentDto } from '../payments/payment.service.js';

// ---------- Users ----------

export async function listUsers(page: number, pageSize: number, search?: string) {
  const where = search
    ? {
        OR: [
          { email: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        role: true,
        _count: { select: { farms: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: users.map((u) => ({
      ...toUserDto(u),
      farmCount: u._count.farms,
      subscription: u.subscriptions[0] ? toSubscriptionDto(u.subscriptions[0]) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateUser(
  adminId: string,
  userId: string,
  updates: { isActive?: boolean; role?: 'ADMIN' | 'FARMER'; emailVerified?: boolean },
  ipAddress?: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (userId === adminId && updates.isActive === false) {
    throw new BadRequestError('You cannot deactivate your own account');
  }

  let roleId: string | undefined;
  if (updates.role) {
    const role = await prisma.role.findUnique({ where: { name: updates.role } });
    if (!role) throw new BadRequestError('Unknown role');
    roleId = role.id;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: updates.isActive,
      emailVerified: updates.emailVerified,
      roleId,
    },
    include: { role: true },
  });

  if (updates.isActive === false) {
    // Kill active sessions when deactivating an account.
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.ADMIN_USER_UPDATED,
    resource: 'user',
    resourceId: userId,
    details: updates,
    ipAddress,
  });

  return toUserDto(updated);
}

// ---------- Farms ----------

export async function listAllFarms(page: number, pageSize: number) {
  const [total, farms] = await Promise.all([
    prisma.farm.count(),
    prisma.farm.findMany({
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { analyses: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: farms.map((f) => ({
      id: f.id,
      name: f.name,
      areaHectares: f.areaHectares,
      cropType: f.cropType,
      centroidLat: f.centroidLat,
      centroidLng: f.centroidLng,
      analysisCount: f._count.analyses,
      owner: {
        id: f.user.id,
        email: f.user.email,
        name: `${f.user.firstName} ${f.user.lastName}`,
      },
      createdAt: f.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------- Payments ----------

export async function listPayments(status: string | undefined, page: number, pageSize: number) {
  const where = status ? { status } : {};
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        plan: true,
        proof: true,
        invoice: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: payments.map((p) => ({
      ...toPaymentDto(p),
      user: {
        id: p.user.id,
        email: p.user.email,
        name: `${p.user.firstName} ${p.user.lastName}`,
      },
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ---------- Subscriptions ----------

export async function listSubscriptions(page: number, pageSize: number) {
  const [total, subs] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.findMany({
      include: {
        plan: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: subs.map((s) => ({
      ...toSubscriptionDto(s),
      user: {
        id: s.user.id,
        email: s.user.email,
        name: `${s.user.firstName} ${s.user.lastName}`,
      },
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function cancelSubscription(adminId: string, subscriptionId: string, ipAddress?: string) {
  const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw new NotFoundError('Subscription');
  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'CANCELLED' },
    include: { plan: true },
  });
  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
    resource: 'subscription',
    resourceId: subscriptionId,
    details: { targetUserId: sub.userId },
    ipAddress,
  });
  return toSubscriptionDto(updated);
}

// ---------- Plans ----------

export async function listAllPlans(): Promise<PlanDto[]> {
  const plans = await prisma.plan.findMany({ orderBy: { priceUsd: 'asc' } });
  return plans.map(toPlanDto);
}

export async function updatePlan(
  adminId: string,
  planId: string,
  input: UpsertPlanInput,
  ipAddress?: string,
): Promise<PlanDto> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError('Plan');

  const updated = await prisma.plan.update({
    where: { id: planId },
    data: {
      name: input.name,
      priceUsd: input.priceUsd,
      billingPeriod: input.billingPeriod,
      maxFarms: input.maxFarms,
      maxAnalysesPerDay: input.maxAnalysesPerDay,
      maxAnalysesTotal: input.maxAnalysesTotal,
      featuresJson: toJson(input.features),
      isContactSales: input.isContactSales,
      isActive: input.isActive,
    },
  });

  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.PLAN_UPDATED,
    resource: 'plan',
    resourceId: planId,
    details: { name: input.name, priceUsd: input.priceUsd },
    ipAddress,
  });

  return toPlanDto(updated);
}

// ---------- Analytics ----------

export async function getAnalytics(): Promise<AdminAnalyticsDto> {
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [
    totalUsers,
    activeSubscriptions,
    trialUsers,
    totalFarms,
    totalAnalyses,
    pendingPayments,
    approvedPayments,
    recentUsers,
    recentAnalyses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIAL' } }),
    prisma.farm.count(),
    prisma.analysis.count(),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.findMany({ where: { status: 'APPROVED' }, select: { amountUsd: true } }),
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.analysis.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalUsers,
    activeSubscriptions,
    trialUsers,
    totalFarms,
    totalAnalyses,
    pendingPayments,
    revenueUsd: Number(approvedPayments.reduce((sum, p) => sum + p.amountUsd, 0).toFixed(2)),
    usersLast30Days: bucketByDay(recentUsers.map((u) => u.createdAt)),
    analysesLast30Days: bucketByDay(recentAnalyses.map((a) => a.createdAt)),
  };
}

function bucketByDay(dates: Date[]): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const date of dates) {
    const key = date.toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
}
