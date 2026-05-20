import "server-only";
import type { OperationTaskType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DefaultItem = {
  type: OperationTaskType;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
};

const DEFAULTS: DefaultItem[] = [
  {
    type: "HOTEL_CONFIRMATION",
    title: "Confirm all hotel bookings",
    description: "Have a confirmation number for every hotel assignment.",
    priority: "HIGH",
  },
  {
    type: "DRIVER_ASSIGNMENT",
    title: "Assign driver / transport",
    description: "Confirm driver, vehicle and pickup details.",
    priority: "MEDIUM",
  },
  {
    type: "PAYMENT_COLLECTION",
    title: "Collect balance payment",
    description: "Recover any outstanding balance from the traveler.",
    priority: "HIGH",
  },
  {
    type: "VOUCHER_SENT",
    title: "Send all vouchers",
    description: "Generate and share vouchers for confirmed services.",
    priority: "MEDIUM",
  },
  {
    type: "DOCUMENT_COLLECTION",
    title: "Collect traveler documents",
    description: "ID proofs, passports, visas — whatever this trip needs.",
    priority: "LOW",
  },
];

/**
 * Idempotent: seeds the default checklist for a trip exactly once.
 * Returns the count of newly created items (0 if already seeded).
 */
export async function ensureDefaultOpsChecklist(
  tripId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const db = tx ?? prisma;
  const existing = await db.operationTask.count({ where: { tripId } });
  if (existing > 0) return 0;

  await db.operationTask.createMany({
    data: DEFAULTS.map((d) => ({
      tripId,
      type: d.type,
      title: d.title,
      description: d.description,
      priority: d.priority,
    })),
  });

  return DEFAULTS.length;
}

/**
 * Marks any pending checklist items of the given type as completed.
 * Used by workflow events (e.g. all hotels confirmed → mark
 * HOTEL_CONFIRMATION done).
 */
export async function autoCompleteOpsTasks(
  tripId: string,
  type: OperationTaskType,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const db = tx ?? prisma;
  const r = await db.operationTask.updateMany({
    where: {
      tripId,
      type,
      status: { not: "COMPLETED" },
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  return r.count;
}
