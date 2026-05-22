"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";
import { formatINR } from "@/lib/utils";

const PAYMENT_TYPES = ["ADVANCE", "PARTIAL", "FINAL"] as const;

const recordSchema = z.object({
  bookingId: z.string(),
  type: z.enum(PAYMENT_TYPES),
  amount: z.coerce.number().min(1),
  method: z.string().max(40).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

export async function recordPaymentAction(
  input: z.infer<typeof recordSchema>
) {
  const data = recordSchema.parse(input);

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { trip: { select: { id: true, contactId: true } } },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === "CANCELLED") {
    throw new Error("Can't record payment on a cancelled booking");
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId: data.bookingId,
      type: data.type,
      amount: data.amount,
      method: data.method?.trim() || null,
      reference: data.reference?.trim() || null,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
    },
  });

  // Recompute paid total from the source of truth (payments rows).
  const agg = await prisma.payment.aggregate({
    where: { bookingId: data.bookingId },
    _sum: { amount: true },
  });
  const paidAmount = agg._sum.amount ?? 0;

  // Auto-promote PENDING → CONFIRMED on first payment; full payment promotes to COMPLETED is opt-in (manual).
  const nextStatus =
    booking.status === "PENDING" ? "CONFIRMED" : booking.status;

  await prisma.booking.update({
    where: { id: data.bookingId },
    data: { paidAmount, status: nextStatus },
  });

  if (booking.trip.contactId) {
    await logActivity({
      contactId: booking.trip.contactId,
      type: "PAYMENT_RECORDED",
      title: `${data.type === "ADVANCE" ? "Advance" : data.type === "FINAL" ? "Final" : "Partial"} payment — ${formatINR(data.amount)}`,
      body: data.method
        ? `via ${data.method}${data.reference ? ` · ${data.reference}` : ""}`
        : null,
      metadata: { paymentId: payment.id, bookingId: data.bookingId },
    });
  }

  revalidatePath(`/trips/${booking.tripId}`);
  revalidatePath("/bookings");
  return { paymentId: payment.id, paidAmount };
}

export async function deletePaymentAction(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { trip: { select: { id: true } } } } },
  });
  if (!payment) throw new Error("Payment not found");

  await prisma.payment.delete({ where: { id: paymentId } });

  const agg = await prisma.payment.aggregate({
    where: { bookingId: payment.bookingId },
    _sum: { amount: true },
  });
  const paidAmount = agg._sum.amount ?? 0;

  await prisma.booking.update({
    where: { id: payment.bookingId },
    data: { paidAmount },
  });

  revalidatePath(`/trips/${payment.booking.trip.id}`);
  revalidatePath("/bookings");
  return { ok: true as const };
}
