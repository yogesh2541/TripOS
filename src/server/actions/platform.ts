"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { getOrCreateSubscription } from "@/server/services/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cancel an agency's TripCraft subscription (immediate). */
export async function cancelAgencySubscriptionAction(agencyId: string) {
  await requirePlatformAdmin();
  await getOrCreateSubscription(agencyId);
  await prisma.subscription.update({
    where: { agencyId },
    data: { status: "CANCELLED", cancelAtPeriodEnd: false },
  });
  revalidatePath("/admin");
  return { ok: true as const };
}

const setPlanSchema = z.object({
  agencyId: z.string(),
  plan: z.enum(["TRIAL", "STARTER", "PRO"]),
});

/**
 * Manually set an agency's plan (comp / manual grant / reactivation). Paid
 * plans go ACTIVE with a 30-day period; TRIAL resets a 14-day trial.
 */
export async function setAgencyPlanAction(input: {
  agencyId: string;
  plan: PlanTier;
}) {
  const { agencyId, plan } = setPlanSchema.parse(input);
  await requirePlatformAdmin();
  await getOrCreateSubscription(agencyId);

  if (plan === "TRIAL") {
    await prisma.subscription.update({
      where: { agencyId },
      data: {
        plan: "TRIAL",
        status: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * DAY_MS),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    await prisma.subscription.update({
      where: { agencyId },
      data: {
        plan,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * DAY_MS),
        cancelAtPeriodEnd: false,
      },
    });
  }
  revalidatePath("/admin");
  return { ok: true as const };
}

const extendSchema = z.object({
  agencyId: z.string(),
  days: z.coerce.number().int().min(1).max(365),
});

/** Extend (or restart) an agency's trial by N days from the later of now/end. */
export async function extendAgencyTrialAction(input: {
  agencyId: string;
  days: number;
}) {
  const { agencyId, days } = extendSchema.parse(input);
  await requirePlatformAdmin();
  const sub = await getOrCreateSubscription(agencyId);
  const base = Math.max(Date.now(), sub.trialEndsAt?.getTime() ?? 0);
  await prisma.subscription.update({
    where: { agencyId },
    data: {
      plan: "TRIAL",
      status: "TRIALING",
      trialEndsAt: new Date(base + days * DAY_MS),
    },
  });
  revalidatePath("/admin");
  return { ok: true as const };
}
