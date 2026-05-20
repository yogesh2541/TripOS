"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";

const MODES = ["CASH", "BANK", "UPI", "CARD", "OTHER"] as const;

const createSchema = z.object({
  vendorId: z.string(),
  tripId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  amount: z.coerce.number().positive("Amount must be > 0"),
  paymentDate: z.string(),
  mode: z.enum(MODES).default("BANK"),
  reference: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type VendorPaymentInput = z.input<typeof createSchema>;

function trimOrNull(s: string | null | undefined) {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

export async function createVendorPaymentAction(input: VendorPaymentInput) {
  const data = createSchema.parse(input);

  const vendor = await prisma.vendor.findFirst({
    where: { id: data.vendorId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!vendor) throw new Error("Vendor not found");

  let trip: { id: string; leadId: string | null } | null = null;
  if (data.tripId) {
    trip = await prisma.trip.findFirst({
      where: { id: data.tripId, deletedAt: null },
      select: { id: true, leadId: true },
    });
    if (!trip) throw new Error("Trip not found");
  }

  const paymentDate = new Date(data.paymentDate);
  if (Number.isNaN(paymentDate.getTime())) {
    throw new Error("Invalid payment date");
  }

  const payment = await prisma.vendorPayment.create({
    data: {
      vendorId: data.vendorId,
      tripId: data.tripId ?? null,
      bookingId: data.bookingId ?? null,
      amount: data.amount,
      paymentDate,
      mode: data.mode,
      reference: trimOrNull(data.reference),
      notes: trimOrNull(data.notes),
    },
  });

  await logActivity({
    vendorId: vendor.id,
    tripId: trip?.id,
    leadId: trip?.leadId,
    type: "VENDOR_PAYMENT_ADDED",
    title: `Paid ${vendor.name} · ₹${Math.round(data.amount).toLocaleString("en-IN")}`,
    metadata: {
      paymentId: payment.id,
      mode: data.mode,
      reference: trimOrNull(data.reference),
    },
  });

  // If this trip's vendor balance is now fully cleared, auto-complete the
  // PAYMENT_COLLECTION checklist item (vendor side of the payment workflow
  // is informational — we leave PAYMENT_COLLECTION alone since that maps to
  // the traveler-side balance).

  revalidatePath("/operations");
  revalidatePath(`/vendors/${vendor.id}`);
  if (data.tripId) revalidatePath(`/trips/${data.tripId}`);
  return { id: payment.id };
}

export type DeletedVendorPaymentSnapshot = {
  vendorId: string;
  tripId: string | null;
  bookingId: string | null;
  amount: number;
  paymentDate: string;
  mode: "CASH" | "BANK" | "UPI" | "CARD" | "OTHER";
  reference: string | null;
  notes: string | null;
};

export async function deleteVendorPaymentAction(paymentId: string) {
  const existing = await prisma.vendorPayment.findUnique({
    where: { id: paymentId },
  });
  if (!existing) throw new Error("Payment not found");

  await prisma.vendorPayment.delete({ where: { id: paymentId } });

  revalidatePath("/operations");
  revalidatePath(`/vendors/${existing.vendorId}`);
  if (existing.tripId) revalidatePath(`/trips/${existing.tripId}`);

  const snapshot: DeletedVendorPaymentSnapshot = {
    vendorId: existing.vendorId,
    tripId: existing.tripId,
    bookingId: existing.bookingId,
    amount: existing.amount,
    paymentDate: existing.paymentDate.toISOString(),
    mode: existing.mode,
    reference: existing.reference,
    notes: existing.notes,
  };
  return { ok: true as const, snapshot };
}

export async function restoreVendorPaymentAction(
  snapshot: DeletedVendorPaymentSnapshot
) {
  const created = await prisma.vendorPayment.create({
    data: {
      vendorId: snapshot.vendorId,
      tripId: snapshot.tripId,
      bookingId: snapshot.bookingId,
      amount: snapshot.amount,
      paymentDate: new Date(snapshot.paymentDate),
      mode: snapshot.mode,
      reference: snapshot.reference,
      notes: snapshot.notes,
    },
  });
  revalidatePath("/operations");
  revalidatePath(`/vendors/${snapshot.vendorId}`);
  if (snapshot.tripId) revalidatePath(`/trips/${snapshot.tripId}`);
  return { id: created.id };
}

