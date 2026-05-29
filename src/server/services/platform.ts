import "server-only";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLANS } from "@/lib/plans";

// Read models for the platform-owner console. All cross-tenant — only ever
// called behind requirePlatformAdmin / getPlatformAdmin.

export type PlatformStats = {
  agencies: number;
  byStatus: Record<SubscriptionStatus, number>;
  paying: number;
  trialing: number;
  users: number;
  trips: number;
  /** Approximate monthly recurring revenue from ACTIVE paid subscriptions. */
  mrr: number;
};

const EMPTY_STATUS: Record<SubscriptionStatus, number> = {
  TRIALING: 0,
  ACTIVE: 0,
  PAST_DUE: 0,
  CANCELLED: 0,
  EXPIRED: 0,
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const [agencies, users, trips, statusGroups, activePlanGroups] =
    await Promise.all([
      prisma.agency.count(),
      prisma.user.count(),
      prisma.trip.count({ where: { deletedAt: null } }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.subscription.groupBy({
        by: ["plan"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
      }),
    ]);

  const byStatus = { ...EMPTY_STATUS };
  for (const g of statusGroups) {
    byStatus[g.status as SubscriptionStatus] = g._count._all;
  }

  const mrr = activePlanGroups.reduce((sum, g) => {
    const def = PLANS[g.plan as PlanTier];
    return sum + (def?.priceMonthly ?? 0) * g._count._all;
  }, 0);

  return {
    agencies,
    byStatus,
    paying: byStatus.ACTIVE,
    trialing: byStatus.TRIALING,
    users,
    trips,
    mrr,
  };
}

export type AdminAgencyRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  members: number;
  trips: number;
  contacts: number;
  plan: PlanTier | null;
  status: SubscriptionStatus | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export async function listAgenciesForAdmin(
  query?: string
): Promise<AdminAgencyRow[]> {
  const q = query?.trim();
  const agencies = await prisma.agency.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            {
              memberships: {
                some: {
                  user: { email: { contains: q, mode: "insensitive" } },
                },
              },
            },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      subscription: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } } },
      },
      _count: { select: { memberships: true, trips: true, contacts: true } },
    },
  });

  return agencies.map((a) => {
    const owner = a.memberships[0]?.user ?? null;
    return {
      id: a.id,
      name: a.name,
      slug: a.slug,
      createdAt: a.createdAt,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      members: a._count.memberships,
      trips: a._count.trips,
      contacts: a._count.contacts,
      plan: a.subscription?.plan ?? null,
      status: a.subscription?.status ?? null,
      trialEndsAt: a.subscription?.trialEndsAt ?? null,
      currentPeriodEnd: a.subscription?.currentPeriodEnd ?? null,
    };
  });
}
