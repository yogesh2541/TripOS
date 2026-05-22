"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";
import { BOOKING_STATUS_LABEL } from "@/lib/crm";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const updateSchema = z.object({
  bookingId: z.string(),
  status: z.enum(STATUSES),
});

export async function updateBookingStatusAction(
  input: z.infer<typeof updateSchema>
) {
  const data = updateSchema.parse(input);
  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    include: { trip: { select: { id: true, contactId: true } } },
  });
  if (!booking) throw new Error("Booking not found");
  if (booking.status === data.status) return { ok: true as const };

  const tripUpdate: { status?: "COMPLETED" | "CANCELLED" } = {};
  if (data.status === "COMPLETED") tripUpdate.status = "COMPLETED";
  if (data.status === "CANCELLED") tripUpdate.status = "CANCELLED";

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: data.bookingId },
      data: { status: data.status },
    }),
    ...(Object.keys(tripUpdate).length > 0
      ? [
          prisma.trip.update({
            where: { id: booking.tripId },
            data: tripUpdate,
          }),
        ]
      : []),
  ]);

  if (booking.trip.contactId) {
    await logActivity({
      contactId: booking.trip.contactId,
      type: "STATUS_CHANGED",
      title: `Booking ${BOOKING_STATUS_LABEL[booking.status as BookingStatus]} → ${BOOKING_STATUS_LABEL[data.status]}`,
      metadata: { bookingId: data.bookingId, from: booking.status, to: data.status },
    });
  }

  revalidatePath(`/trips/${booking.tripId}`);
  revalidatePath("/bookings");
  return { ok: true as const };
}

export async function cancelBookingAction(bookingId: string) {
  return updateBookingStatusAction({ bookingId, status: "CANCELLED" });
}
