import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogInput = {
  contactId?: string | null;
  tripId?: string | null;
  vendorId?: string | null;
  invoiceId?: string | null;
  // Who performed the action. Pass the session user's id for interactive
  // events; leave undefined for system / automation / webhook events.
  actorId?: string | null;
  type: ActivityType;
  title: string;
  body?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logActivity(input: LogInput) {
  if (!input.contactId && !input.tripId && !input.vendorId && !input.invoiceId) {
    throw new Error(
      "logActivity requires at least one of contactId / tripId / vendorId / invoiceId"
    );
  }
  return prisma.activity.create({
    data: {
      contactId: input.contactId ?? null,
      tripId: input.tripId ?? null,
      vendorId: input.vendorId ?? null,
      invoiceId: input.invoiceId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      metadata: input.metadata,
    },
  });
}
