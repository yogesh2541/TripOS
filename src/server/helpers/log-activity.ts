import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogInput = {
  leadId?: string | null;
  tripId?: string | null;
  vendorId?: string | null;
  type: ActivityType;
  title: string;
  body?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logActivity(input: LogInput) {
  if (!input.leadId && !input.tripId && !input.vendorId) {
    throw new Error("logActivity requires at least one of leadId / tripId / vendorId");
  }
  return prisma.activity.create({
    data: {
      leadId: input.leadId ?? null,
      tripId: input.tripId ?? null,
      vendorId: input.vendorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata,
    },
  });
}
