import type { PlanDto, SubscriptionDto } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { fromJson } from '../../lib/json.js';
import { NotFoundError } from '../../lib/errors.js';

type PlanRecord = NonNullable<Awaited<ReturnType<typeof prisma.plan.findUnique>>>;
type SubscriptionWithPlan = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.subscription.findFirst<{
        where: object;
        include: { plan: true };
      }>
    >
  >
>;

export function toPlanDto(plan: PlanRecord): PlanDto {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    priceUsd: plan.priceUsd,
    billingPeriod: plan.billingPeriod as PlanDto['billingPeriod'],
    maxFarms: plan.maxFarms,
    maxAnalysesPerDay: plan.maxAnalysesPerDay,
    maxAnalysesTotal: plan.maxAnalysesTotal,
    features: fromJson<string[]>(plan.featuresJson) ?? [],
    isContactSales: plan.isContactSales,
    isActive: plan.isActive,
  };
}

export function toSubscriptionDto(sub: SubscriptionWithPlan): SubscriptionDto {
  const reference =
    sub.status === 'TRIAL' ? sub.trialEndsAt : sub.endDate;
  const daysRemaining = reference
    ? Math.max(0, Math.ceil((reference.getTime() - Date.now()) / 86_400_000))
    : null;
  return {
    id: sub.id,
    plan: toPlanDto(sub.plan),
    status: sub.status as SubscriptionDto['status'],
    startDate: sub.startDate.toISOString(),
    endDate: sub.endDate?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    daysRemaining,
  };
}

/**
 * Return the user's current subscription, lazily expiring TRIAL/ACTIVE
 * subscriptions whose end date has passed.
 */
export async function getCurrentSubscription(userId: string): Promise<SubscriptionWithPlan> {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });
  if (!sub) throw new NotFoundError('Subscription');

  const now = new Date();
  const expired =
    (sub.status === 'TRIAL' && sub.trialEndsAt && sub.trialEndsAt < now) ||
    (sub.status === 'ACTIVE' && sub.endDate && sub.endDate < now);

  if (expired) {
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
      include: { plan: true },
    });
  }
  return sub;
}

export async function listActivePlans(): Promise<PlanDto[]> {
  const plans = await prisma.plan.findMany({
    where: { isActive: true, NOT: { slug: 'trial' } },
    orderBy: { priceUsd: 'asc' },
  });
  return plans.map(toPlanDto);
}
