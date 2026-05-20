"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";
import { autoCompleteOpsTasks } from "@/server/helpers/ops-checklist";
import {
  buildVoucherSnapshot,
  shareTokenFromBytes,
} from "@/server/services/vouchers";

export async function generateVoucherAction(assignmentId: string) {
  const assignment = await prisma.vendorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      vendor: { select: { id: true, name: true } },
      trip: { select: { id: true, leadId: true } },
    },
  });
  if (!assignment) throw new Error("Assignment not found");
  if (
    assignment.status !== "CONFIRMED" &&
    assignment.status !== "COMPLETED"
  ) {
    throw new Error(
      "Confirm the vendor before generating a voucher."
    );
  }

  const snapshot = await buildVoucherSnapshot(assignmentId);
  const shareToken = shareTokenFromBytes();

  const voucher = await prisma.voucher.create({
    data: {
      assignmentId,
      voucherNumber: snapshot.voucherNumber,
      shareToken,
      title: `${snapshot.vendor.name} · ${snapshot.service.title}`,
      content: snapshot,
    },
  });

  await logActivity({
    tripId: assignment.trip.id,
    vendorId: assignment.vendor.id,
    leadId: assignment.trip.leadId,
    type: "VOUCHER_GENERATED",
    title: `Voucher ${snapshot.voucherNumber} · ${assignment.vendor.name}`,
    metadata: { voucherId: voucher.id, assignmentId },
  });

  revalidatePath(`/trips/${assignment.trip.id}`);
  return { id: voucher.id, voucherNumber: voucher.voucherNumber, shareToken };
}

const markSentSchema = z.object({
  voucherId: z.string(),
});

export async function markVoucherSentAction(
  input: z.infer<typeof markSentSchema>
) {
  const data = markSentSchema.parse(input);

  const voucher = await prisma.voucher.findUnique({
    where: { id: data.voucherId },
    include: {
      assignment: {
        include: {
          vendor: { select: { id: true, name: true } },
          trip: { select: { id: true, leadId: true } },
        },
      },
    },
  });
  if (!voucher) throw new Error("Voucher not found");

  await prisma.$transaction(async (tx) => {
    await tx.voucher.update({
      where: { id: data.voucherId },
      data: { sentAt: new Date() },
    });
    await tx.vendorAssignment.update({
      where: { id: voucher.assignmentId },
      data: { voucherSent: true },
    });
  });

  await logActivity({
    tripId: voucher.assignment.trip.id,
    vendorId: voucher.assignment.vendor.id,
    leadId: voucher.assignment.trip.leadId,
    type: "VOUCHER_SENT",
    title: `Sent voucher ${voucher.voucherNumber} · ${voucher.assignment.vendor.name}`,
    metadata: { voucherId: voucher.id },
  });

  // If every confirmed assignment on the trip now has a sent voucher,
  // auto-complete the VOUCHER_SENT checklist item.
  const remaining = await prisma.vendorAssignment.count({
    where: {
      tripId: voucher.assignment.trip.id,
      status: { in: ["CONFIRMED", "COMPLETED"] },
      voucherSent: false,
    },
  });
  if (remaining === 0) {
    await autoCompleteOpsTasks(voucher.assignment.trip.id, "VOUCHER_SENT");
  }

  revalidatePath(`/trips/${voucher.assignment.trip.id}`);
  return { ok: true as const };
}

export async function regenerateVoucherAction(voucherId: string) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      assignment: {
        select: {
          id: true,
          tripId: true,
          vendorId: true,
          trip: { select: { leadId: true } },
        },
      },
    },
  });
  if (!voucher) throw new Error("Voucher not found");

  const snapshot = await buildVoucherSnapshot(voucher.assignmentId);

  await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      content: snapshot,
      title: `${snapshot.vendor.name} · ${snapshot.service.title}`,
      generatedAt: new Date(),
    },
  });

  await logActivity({
    tripId: voucher.assignment.tripId,
    vendorId: voucher.assignment.vendorId,
    leadId: voucher.assignment.trip.leadId,
    type: "VOUCHER_GENERATED",
    title: `Voucher ${voucher.voucherNumber} regenerated`,
    metadata: { voucherId: voucher.id },
  });

  revalidatePath(`/trips/${voucher.assignment.tripId}`);
  return { ok: true as const };
}

export type DeletedVoucherSnapshot = {
  assignmentId: string;
  tripId: string;
  voucherNumber: string;
  shareToken: string;
  title: string;
  // We use Prisma's JSON shape directly; runtime is snapshotted server-side.
  content: unknown;
  generatedAt: string;
  sentAt: string | null;
  downloadCount: number;
};

export async function deleteVoucherAction(voucherId: string) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      assignment: { select: { tripId: true } },
    },
  });
  if (!voucher) throw new Error("Voucher not found");

  await prisma.voucher.delete({ where: { id: voucherId } });

  // If the assignment has no remaining vouchers, clear voucherSent
  const remaining = await prisma.voucher.count({
    where: { assignmentId: voucher.assignmentId },
  });
  if (remaining === 0) {
    await prisma.vendorAssignment.update({
      where: { id: voucher.assignmentId },
      data: { voucherSent: false },
    });
  }

  revalidatePath(`/trips/${voucher.assignment.tripId}`);

  const snapshot: DeletedVoucherSnapshot = {
    assignmentId: voucher.assignmentId,
    tripId: voucher.assignment.tripId,
    voucherNumber: voucher.voucherNumber,
    shareToken: voucher.shareToken,
    title: voucher.title,
    content: voucher.content,
    generatedAt: voucher.generatedAt.toISOString(),
    sentAt: voucher.sentAt?.toISOString() ?? null,
    downloadCount: voucher.downloadCount,
  };
  return { ok: true as const, snapshot };
}

export async function restoreVoucherAction(snapshot: DeletedVoucherSnapshot) {
  // If the original token/number are still free (which they are, since we
  // hard-deleted), restore them so QR codes / share links keep working.
  const restored = await prisma.voucher.create({
    data: {
      assignmentId: snapshot.assignmentId,
      voucherNumber: snapshot.voucherNumber,
      shareToken: snapshot.shareToken,
      title: snapshot.title,
      content: snapshot.content as never,
      generatedAt: new Date(snapshot.generatedAt),
      sentAt: snapshot.sentAt ? new Date(snapshot.sentAt) : null,
      downloadCount: snapshot.downloadCount,
    },
  });
  if (snapshot.sentAt) {
    await prisma.vendorAssignment.update({
      where: { id: snapshot.assignmentId },
      data: { voucherSent: true },
    });
  }
  revalidatePath(`/trips/${snapshot.tripId}`);
  return { id: restored.id };
}
