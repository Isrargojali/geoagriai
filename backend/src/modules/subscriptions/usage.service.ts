import type { UsageDto } from '@geoagri/shared';
import { prisma } from '../../lib/prisma.js';
import { LimitExceededError } from '../../lib/errors.js';
import { getCurrentSubscription } from './subscription.service.js';

/**
 * Compute the user's current usage against their plan limits.
 *
 * Expired subscriptions keep read access to existing data but cannot create
 * farms or run new analyses (the upgrade path re-enables them).
 */
export async function getUsage(userId: string): Promise<UsageDto> {
  const sub = await getCurrentSubscription(userId);
  const plan = sub.plan;
  const subscriptionUsable = sub.status === 'TRIAL' || sub.status === 'ACTIVE';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [farmCount, analysesToday, analysesTotal] = await Promise.all([
    prisma.farm.count({ where: { userId } }),
    prisma.analysis.count({ where: { userId, createdAt: { gte: startOfToday } } }),
    prisma.analysis.count({ where: { userId } }),
  ]);

  let blockedReason: string | null = null;
  if (!subscriptionUsable) {
    blockedReason =
      sub.status === 'EXPIRED'
        ? 'Your subscription has expired. Upgrade to continue running analyses — your existing data remains viewable.'
        : 'Your subscription is not active. Please choose a plan to continue.';
  }

  const farmLimitReached = plan.maxFarms != null && farmCount >= plan.maxFarms;
  const dailyLimitReached =
    plan.maxAnalysesPerDay != null && analysesToday >= plan.maxAnalysesPerDay;
  const totalLimitReached =
    plan.maxAnalysesTotal != null && analysesTotal >= plan.maxAnalysesTotal;

  return {
    farms: { used: farmCount, limit: plan.maxFarms },
    analysesToday: { used: analysesToday, limit: plan.maxAnalysesPerDay },
    analysesTotal: { used: analysesTotal, limit: plan.maxAnalysesTotal },
    canCreateFarm: subscriptionUsable && !farmLimitReached,
    canRunAnalysis:
      subscriptionUsable && !dailyLimitReached && !totalLimitReached,
    blockedReason,
  };
}

export async function assertCanCreateFarm(userId: string): Promise<void> {
  const usage = await getUsage(userId);
  if (usage.canCreateFarm) return;
  throw new LimitExceededError(
    usage.blockedReason ??
      `Your plan allows a maximum of ${usage.farms.limit} farm(s). Upgrade to add more.`,
  );
}

export async function assertCanRunAnalysis(userId: string): Promise<void> {
  const usage = await getUsage(userId);
  if (usage.canRunAnalysis) return;
  if (usage.blockedReason) throw new LimitExceededError(usage.blockedReason);
  if (usage.analysesToday.limit != null && usage.analysesToday.used >= usage.analysesToday.limit) {
    throw new LimitExceededError(
      `Daily analysis limit reached (${usage.analysesToday.limit}/day). Try again tomorrow or upgrade your plan.`,
    );
  }
  throw new LimitExceededError(
    `Total analysis limit reached (${usage.analysesTotal.limit}). Upgrade your plan to continue.`,
  );
}
