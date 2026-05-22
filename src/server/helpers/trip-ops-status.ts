import "server-only";
import type { Prisma, TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";

/**
 * Recompute a trip's operational status based on its vendor assignments.
 *
 * Transitions (only fires from booking-side states; never overrides
 * PLANNING/QUOTED/COMPLETED/CANCELLED — those are sales-side):
 *   no live assignments      → no change
 *   any live assignments     → VENDOR_CONFIRMATION_PENDING (if currently BOOKED)
 *   ≥1 confirmed but not all → PARTIALLY_CONFIRMED
 *   all live confirmed       → READY_TO_TRAVEL
 */
export async function recomputeTripOpsStatus(
  tripId: string,
  tx?: Prisma.TransactionClient
): Promise<TripStatus | null> {
  const db = tx ?? prisma;

  const trip = await db.trip.findUnique({
    where: { id: tripId },
    select: { status: true, contactId: true },
  });
  if (!trip) return null;

  // Don't override sales-side states.
  const opsStates: TripStatus[] = [
    "BOOKED",
    "VENDOR_CONFIRMATION_PENDING",
    "PARTIALLY_CONFIRMED",
    "READY_TO_TRAVEL",
    "IN_PROGRESS",
  ];
  if (!opsStates.includes(trip.status)) return null;

  const assignments = await db.vendorAssignment.findMany({
    where: { tripId, status: { not: "CANCELLED" } },
    select: { status: true },
  });

  if (assignments.length === 0) return null;

  const allConfirmed = assignments.every(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  );
  const anyConfirmed = assignments.some(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  );

  let next: TripStatus;
  if (allConfirmed) next = "READY_TO_TRAVEL";
  else if (anyConfirmed) next = "PARTIALLY_CONFIRMED";
  else next = "VENDOR_CONFIRMATION_PENDING";

  // Don't downgrade IN_PROGRESS — once trip has started, vendor mutations
  // shouldn't yank status backward.
  if (trip.status === "IN_PROGRESS") return null;

  if (next === trip.status) return trip.status;

  await db.trip.update({
    where: { id: tripId },
    data: { status: next },
  });

  await logActivity({
    tripId,
    contactId: trip.contactId,
    type: next === "READY_TO_TRAVEL" ? "TRIP_READY" : "STATUS_CHANGED",
    title:
      next === "READY_TO_TRAVEL"
        ? "Trip ready to travel"
        : `Trip status: ${trip.status} → ${next}`,
    metadata: { from: trip.status, to: next },
  });

  return next;
}
