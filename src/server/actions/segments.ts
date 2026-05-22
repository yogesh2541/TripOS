"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { dayNumberForDate } from "@/lib/utils";

const baseSchema = z
  .object({
    tripId: z.string(),
    type: z.enum(["FLIGHT", "TRAIN"]),
    dayNumber: z.coerce.number().int().min(1).max(60).default(1),
    from: z.string().min(1, "From is required").max(80),
    to: z.string().min(1, "To is required").max(80),
    departureTime: z.string().min(1, "Departure time is required"),
    arrivalTime: z.string().min(1, "Arrival time is required"),
    airline: z.string().max(80).optional().nullable(),
    flightNumber: z.string().max(40).optional().nullable(),
    pnr: z.string().max(40).optional().nullable(),
    trainName: z.string().max(80).optional().nullable(),
    trainNumber: z.string().max(40).optional().nullable(),
    coach: z.string().max(20).optional().nullable(),
    seat: z.string().max(40).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  // Arrival must be strictly after departure — a flight can't land before
  // it takes off. Overnight journeys are fine: the timestamps span midnight.
  .refine(
    (d) => {
      const dep = new Date(d.departureTime).getTime();
      const arr = new Date(d.arrivalTime).getTime();
      return Number.isFinite(dep) && Number.isFinite(arr) && arr > dep;
    },
    { message: "Arrival must be after departure.", path: ["arrivalTime"] }
  );

export type CreateSegmentInput = z.infer<typeof baseSchema>;

function normalize(data: CreateSegmentInput) {
  // Strip fields that don't apply to the chosen type so we don't store noise.
  const isFlight = data.type === "FLIGHT";
  return {
    type: data.type,
    dayNumber: data.dayNumber,
    from: data.from.trim(),
    to: data.to.trim(),
    departureTime: new Date(data.departureTime),
    arrivalTime: new Date(data.arrivalTime),
    airline: isFlight ? data.airline?.trim() || null : null,
    flightNumber: isFlight ? data.flightNumber?.trim() || null : null,
    pnr: isFlight ? data.pnr?.trim() || null : null,
    trainName: !isFlight ? data.trainName?.trim() || null : null,
    trainNumber: !isFlight ? data.trainNumber?.trim() || null : null,
    coach: !isFlight ? data.coach?.trim() || null : null,
    seat: !isFlight ? data.seat?.trim() || null : null,
    notes: data.notes?.trim() || null,
  };
}

/**
 * Loads a trip and confirms it belongs to the caller's agency. Throws
 * otherwise — the single tenancy fence for every segment mutation.
 */
async function requireTrip(tripId: string, agencyId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
    select: { id: true, days: true, startDate: true },
  });
  if (!trip) throw new Error("Trip not found");
  return trip;
}

/**
 * The authoritative day number for a segment: derived from its departure
 * date relative to the trip's start date, clamped into the trip's range.
 * Falls back to the (clamped) client value when the trip has no start date.
 */
function resolveDayNumber(
  departureTime: string,
  trip: { days: number; startDate: Date | null },
  clientDayNumber: number
): number {
  const derived = dayNumberForDate(new Date(departureTime), trip.startDate);
  const raw = derived ?? clientDayNumber;
  return Math.max(1, Math.min(trip.days, raw));
}

export async function createTravelSegmentAction(input: CreateSegmentInput) {
  const data = baseSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");
  const trip = await requireTrip(data.tripId, agencyId);

  const dayNumber = resolveDayNumber(data.departureTime, trip, data.dayNumber);

  const segment = await prisma.travelSegment.create({
    data: {
      tripId: data.tripId,
      ...normalize({ ...data, dayNumber }),
    },
  });
  revalidatePath(`/trips/${data.tripId}`);
  revalidatePath(`/trips/${data.tripId}/preview`);
  return { id: segment.id };
}

const updateSchema = z.object({
  tripId: z.string().optional(),
  type: z.enum(["FLIGHT", "TRAIN"]).optional(),
  dayNumber: z.coerce.number().int().min(1).max(60).optional(),
  from: z.string().min(1).max(80).optional(),
  to: z.string().min(1).max(80).optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  airline: z.string().max(80).optional().nullable(),
  flightNumber: z.string().max(40).optional().nullable(),
  pnr: z.string().max(40).optional().nullable(),
  trainName: z.string().max(80).optional().nullable(),
  trainNumber: z.string().max(40).optional().nullable(),
  coach: z.string().max(20).optional().nullable(),
  seat: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function updateTravelSegmentAction(
  segmentId: string,
  input: z.infer<typeof updateSchema>
) {
  const patch = updateSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");

  const existing = await prisma.travelSegment.findUnique({
    where: { id: segmentId },
  });
  if (!existing) throw new Error("Segment not found");
  const trip = await requireTrip(existing.tripId, agencyId);

  // baseSchema re-validates the merged record — including arrival > departure.
  const merged = baseSchema.parse({
    tripId: existing.tripId,
    type: patch.type ?? existing.type,
    dayNumber: patch.dayNumber ?? existing.dayNumber,
    from: patch.from ?? existing.from,
    to: patch.to ?? existing.to,
    departureTime: patch.departureTime ?? existing.departureTime.toISOString(),
    arrivalTime: patch.arrivalTime ?? existing.arrivalTime.toISOString(),
    airline: patch.airline === undefined ? existing.airline : patch.airline,
    flightNumber:
      patch.flightNumber === undefined
        ? existing.flightNumber
        : patch.flightNumber,
    pnr: patch.pnr === undefined ? existing.pnr : patch.pnr,
    trainName:
      patch.trainName === undefined ? existing.trainName : patch.trainName,
    trainNumber:
      patch.trainNumber === undefined
        ? existing.trainNumber
        : patch.trainNumber,
    coach: patch.coach === undefined ? existing.coach : patch.coach,
    seat: patch.seat === undefined ? existing.seat : patch.seat,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
  });

  const dayNumber = resolveDayNumber(
    merged.departureTime,
    trip,
    merged.dayNumber
  );

  await prisma.travelSegment.update({
    where: { id: segmentId },
    data: normalize({ ...merged, dayNumber }),
  });
  revalidatePath(`/trips/${existing.tripId}`);
  revalidatePath(`/trips/${existing.tripId}/preview`);
  return { ok: true as const };
}

export async function deleteTravelSegmentAction(segmentId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");
  const segment = await prisma.travelSegment.findUnique({
    where: { id: segmentId },
    select: { id: true, tripId: true },
  });
  if (!segment) throw new Error("Segment not found");
  await requireTrip(segment.tripId, agencyId);

  await prisma.travelSegment.delete({ where: { id: segmentId } });
  revalidatePath(`/trips/${segment.tripId}`);
  revalidatePath(`/trips/${segment.tripId}/preview`);
  return { ok: true as const };
}

export async function addSegmentToQuoteAction(segmentId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:update");
  const segment = await prisma.travelSegment.findUnique({
    where: { id: segmentId },
  });
  if (!segment) throw new Error("Segment not found");
  await requireTrip(segment.tripId, agencyId);

  // Land it on the latest DRAFT, otherwise spin up a fresh DRAFT version.
  let quote = await prisma.quote.findFirst({
    where: { tripId: segment.tripId, status: "DRAFT" },
    orderBy: { version: "desc" },
  });
  if (!quote) {
    const latest = await prisma.quote.findFirst({
      where: { tripId: segment.tripId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    quote = await prisma.quote.create({
      data: {
        tripId: segment.tripId,
        version: (latest?.version ?? 0) + 1,
        status: "DRAFT",
      },
    });
  }

  const route = `${segment.from} → ${segment.to}`;
  const identifier =
    segment.type === "FLIGHT"
      ? segment.flightNumber || segment.airline
      : segment.trainNumber || segment.trainName;
  const label =
    segment.type === "FLIGHT"
      ? `Flight: ${route}${identifier ? ` (${identifier})` : ""}`
      : `Train: ${route}${identifier ? ` (${identifier})` : ""}`;

  const lastPos = await prisma.quoteItem.findFirst({
    where: { quoteId: quote.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.quoteItem.create({
    data: {
      quoteId: quote.id,
      category: "Transport",
      label,
      cost: 0,
      position: (lastPos?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/trips/${segment.tripId}`);
  return { quoteId: quote.id, version: quote.version };
}
