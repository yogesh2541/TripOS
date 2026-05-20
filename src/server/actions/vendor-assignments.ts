"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";
import { recomputeTripOpsStatus } from "@/server/helpers/trip-ops-status";
import {
  autoCompleteOpsTasks,
  ensureDefaultOpsChecklist,
} from "@/server/helpers/ops-checklist";

const CATEGORIES = [
  "HOTEL",
  "TRANSFER",
  "SIGHTSEEING",
  "ACTIVITY",
  "GUIDE",
  "FLIGHT",
  "TRAIN",
  "OTHER",
] as const;

const STATUSES = [
  "PENDING",
  "REQUESTED",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
] as const;

const baseSchema = z.object({
  tripId: z.string(),
  vendorId: z.string(),
  category: z.enum(CATEGORIES),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(0).optional().nullable(),
  unitCost: z.coerce.number().min(0).optional().nullable(),
  totalCost: z.coerce.number().min(0).optional().nullable(),
  sellingPrice: z.coerce.number().min(0).optional().nullable(),
  confirmationNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  customerVisible: z.boolean().default(true),
});

export type AssignmentFormInput = z.input<typeof baseSchema>;

function toNullableDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function trimOrNull(s: string | null | undefined) {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export async function createVendorAssignmentAction(
  input: AssignmentFormInput
) {
  const data = baseSchema.parse(input);

  const [trip, vendor] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: data.tripId, deletedAt: null },
      select: { id: true, leadId: true, status: true },
    }),
    prisma.vendor.findFirst({
      where: { id: data.vendorId, deletedAt: null },
      select: { id: true, name: true, isActive: true },
    }),
  ]);
  if (!trip) throw new Error("Trip not found");
  if (!vendor) throw new Error("Vendor not found");

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.vendorAssignment.create({
      data: {
        tripId: data.tripId,
        vendorId: data.vendorId,
        category: data.category,
        title: data.title.trim(),
        description: trimOrNull(data.description),
        startDate: toNullableDate(data.startDate),
        endDate: toNullableDate(data.endDate),
        quantity: data.quantity ?? null,
        unitCost: data.unitCost ?? null,
        totalCost: data.totalCost ?? null,
        sellingPrice: data.sellingPrice ?? null,
        confirmationNumber: trimOrNull(data.confirmationNumber),
        notes: trimOrNull(data.notes),
        customerVisible: data.customerVisible ?? true,
      },
    });

    await logActivity({
      tripId: trip.id,
      vendorId: vendor.id,
      leadId: trip.leadId,
      type: "VENDOR_ASSIGNED",
      title: `Assigned ${vendor.name} · ${data.title.trim()}`,
      metadata: {
        assignmentId: created.id,
        category: data.category,
      },
    });

    // First vendor assigned → push BOOKED trip into VENDOR_CONFIRMATION_PENDING
    if (trip.status === "BOOKED") {
      await tx.trip.update({
        where: { id: trip.id },
        data: { status: "VENDOR_CONFIRMATION_PENDING" },
      });
      await logActivity({
        tripId: trip.id,
        leadId: trip.leadId,
        type: "STATUS_CHANGED",
        title: "Trip status: BOOKED → VENDOR_CONFIRMATION_PENDING",
        metadata: { from: "BOOKED", to: "VENDOR_CONFIRMATION_PENDING" },
      });
    }

    // First vendor assignment of any kind → seed the default ops checklist
    await ensureDefaultOpsChecklist(trip.id, tx);

    return created;
  });

  await recomputeTripOpsStatus(trip.id);

  revalidatePath(`/trips/${trip.id}`);
  revalidatePath(`/vendors/${vendor.id}`);
  return { id: assignment.id };
}

export async function updateVendorAssignmentAction(
  assignmentId: string,
  input: AssignmentFormInput
) {
  const data = baseSchema.parse(input);

  const existing = await prisma.vendorAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, tripId: true, vendorId: true },
  });
  if (!existing) throw new Error("Assignment not found");

  await prisma.vendorAssignment.update({
    where: { id: assignmentId },
    data: {
      vendorId: data.vendorId,
      category: data.category,
      title: data.title.trim(),
      description: trimOrNull(data.description),
      startDate: toNullableDate(data.startDate),
      endDate: toNullableDate(data.endDate),
      quantity: data.quantity ?? null,
      unitCost: data.unitCost ?? null,
      totalCost: data.totalCost ?? null,
      sellingPrice: data.sellingPrice ?? null,
      confirmationNumber: trimOrNull(data.confirmationNumber),
      notes: trimOrNull(data.notes),
      customerVisible: data.customerVisible ?? true,
    },
  });

  revalidatePath(`/trips/${existing.tripId}`);
  revalidatePath(`/vendors/${data.vendorId}`);
  return { ok: true as const };
}

const transitionSchema = z.object({
  assignmentId: z.string(),
  status: z.enum(STATUSES),
  confirmationNumber: z.string().max(100).optional().nullable(),
});

export async function transitionVendorAssignmentAction(
  input: z.infer<typeof transitionSchema>
) {
  const data = transitionSchema.parse(input);

  const existing = await prisma.vendorAssignment.findUnique({
    where: { id: data.assignmentId },
    include: {
      vendor: { select: { id: true, name: true } },
      trip: { select: { id: true, leadId: true, status: true } },
    },
  });
  if (!existing) throw new Error("Assignment not found");
  if (existing.status === data.status) return { ok: true as const };

  await prisma.vendorAssignment.update({
    where: { id: data.assignmentId },
    data: {
      status: data.status,
      confirmationNumber:
        data.confirmationNumber !== undefined
          ? trimOrNull(data.confirmationNumber)
          : undefined,
    },
  });

  // Activity logging
  if (data.status === "CONFIRMED") {
    await logActivity({
      tripId: existing.tripId,
      vendorId: existing.vendorId,
      leadId: existing.trip.leadId,
      type: "VENDOR_CONFIRMED",
      title: `Confirmed ${existing.vendor.name} · ${existing.title}`,
      metadata: {
        assignmentId: existing.id,
        confirmationNumber: trimOrNull(data.confirmationNumber),
      },
    });
  } else if (data.status === "CANCELLED") {
    await logActivity({
      tripId: existing.tripId,
      vendorId: existing.vendorId,
      leadId: existing.trip.leadId,
      type: "VENDOR_CANCELLED",
      title: `Cancelled ${existing.vendor.name} · ${existing.title}`,
      metadata: { assignmentId: existing.id },
    });
  } else if (data.status === "COMPLETED") {
    await logActivity({
      tripId: existing.tripId,
      vendorId: existing.vendorId,
      leadId: existing.trip.leadId,
      type: "CUSTOM",
      title: `Marked complete · ${existing.vendor.name} · ${existing.title}`,
      metadata: { assignmentId: existing.id },
    });
  }

  // Workflow: when all hotels in a trip become CONFIRMED/COMPLETED,
  // auto-complete the HOTEL_CONFIRMATION checklist item. Same for
  // transport categories with DRIVER_ASSIGNMENT.
  if (data.status === "CONFIRMED" || data.status === "COMPLETED") {
    await maybeAutoCompleteCategoryChecklist(existing.tripId, existing.category);
  }

  await recomputeTripOpsStatus(existing.tripId);

  revalidatePath(`/trips/${existing.tripId}`);
  revalidatePath(`/vendors/${existing.vendorId}`);
  return { ok: true as const };
}

async function maybeAutoCompleteCategoryChecklist(
  tripId: string,
  category: string
) {
  const map: Record<string, "HOTEL_CONFIRMATION" | "DRIVER_ASSIGNMENT" | null> = {
    HOTEL: "HOTEL_CONFIRMATION",
    TRANSFER: "DRIVER_ASSIGNMENT",
    FLIGHT: null,
    TRAIN: null,
    SIGHTSEEING: null,
    ACTIVITY: null,
    GUIDE: null,
    OTHER: null,
  };
  const taskType = map[category];
  if (!taskType) return;

  const allInCategory = await prisma.vendorAssignment.findMany({
    where: { tripId, category: category as never },
    select: { status: true },
  });
  if (allInCategory.length === 0) return;
  const allDone = allInCategory.every(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  );
  if (allDone) {
    await autoCompleteOpsTasks(tripId, taskType);
  }
}

export type DeletedVendorAssignmentSnapshot = AssignmentFormInput & {
  status:
    | "PENDING"
    | "REQUESTED"
    | "CONFIRMED"
    | "CANCELLED"
    | "COMPLETED";
  voucherSent: boolean;
};

export async function deleteVendorAssignmentAction(assignmentId: string) {
  const existing = await prisma.vendorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      _count: { select: { vouchers: true } },
    },
  });
  if (!existing) throw new Error("Assignment not found");
  if (existing._count.vouchers > 0) {
    throw new Error(
      "Vouchers exist for this assignment. Cancel instead of deleting."
    );
  }

  await prisma.vendorAssignment.delete({ where: { id: assignmentId } });

  await recomputeTripOpsStatus(existing.tripId);

  revalidatePath(`/trips/${existing.tripId}`);
  revalidatePath(`/vendors/${existing.vendorId}`);

  const snapshot: DeletedVendorAssignmentSnapshot = {
    tripId: existing.tripId,
    vendorId: existing.vendorId,
    category: existing.category,
    title: existing.title,
    description: existing.description,
    startDate: existing.startDate?.toISOString() ?? null,
    endDate: existing.endDate?.toISOString() ?? null,
    quantity: existing.quantity,
    unitCost: existing.unitCost,
    totalCost: existing.totalCost,
    sellingPrice: existing.sellingPrice,
    confirmationNumber: existing.confirmationNumber,
    notes: existing.notes,
    customerVisible: existing.customerVisible,
    status: existing.status,
    voucherSent: existing.voucherSent,
  };
  return { ok: true as const, snapshot };
}

export async function restoreVendorAssignmentAction(
  snapshot: DeletedVendorAssignmentSnapshot
) {
  const restored = await prisma.vendorAssignment.create({
    data: {
      tripId: snapshot.tripId,
      vendorId: snapshot.vendorId,
      category: snapshot.category,
      title: snapshot.title,
      description: snapshot.description ?? null,
      startDate: snapshot.startDate ? new Date(snapshot.startDate) : null,
      endDate: snapshot.endDate ? new Date(snapshot.endDate) : null,
      quantity: snapshot.quantity ?? null,
      unitCost: snapshot.unitCost ?? null,
      totalCost: snapshot.totalCost ?? null,
      sellingPrice: snapshot.sellingPrice ?? null,
      confirmationNumber: snapshot.confirmationNumber ?? null,
      notes: snapshot.notes ?? null,
      customerVisible: snapshot.customerVisible ?? true,
      status: snapshot.status,
      voucherSent: snapshot.voucherSent,
    },
  });
  await recomputeTripOpsStatus(snapshot.tripId);
  revalidatePath(`/trips/${snapshot.tripId}`);
  revalidatePath(`/vendors/${snapshot.vendorId}`);
  return { id: restored.id };
}
