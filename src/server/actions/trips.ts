"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { generateItineraryAI } from "@/lib/ai";
import { logActivity } from "@/server/helpers/log-activity";

const tripSchema = z.object({
  destination: z.string().min(2, "Destination is required").max(80),
  days: z.coerce.number().int().min(1).max(30),
  travelers: z.coerce.number().int().min(1).max(40),
  startDate: z.string().optional().nullable(),
  budget: z.coerce.number().int().min(0).optional().nullable(),
  travelType: z.enum(["Luxury", "Budget", "Family", "Honeymoon"]),
  pace: z.enum(["Relaxed", "Moderate", "Packed"]).default("Moderate"),
  hotelType: z
    .enum(["Boutique", "Luxury Resort", "Heritage", "Villa", "Standard"])
    .default("Boutique"),
  interests: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional().nullable(),
  contactId: z.string().optional().nullable(),
});

export type CreateTripInput = z.infer<typeof tripSchema>;

export async function createTripAction(input: CreateTripInput) {
  const data = tripSchema.parse(input);
  const user = await assertCan("trip:create");

  // A trip can stand alone — no contact required. It stays fully tracked
  // via its own Trip row + activity timeline, and can be linked to a
  // contact at any time from the trip workspace. We no longer mint a
  // placeholder "Direct —" contact, which only cluttered the pipeline.
  // Any supplied contactId is verified to belong to this agency.
  let contactId: string | null = null;
  if (data.contactId) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: data.contactId,
        agencyId: user.activeAgencyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    contactId = contact?.id ?? null;
  }

  const trip = await prisma.trip.create({
    data: {
      agencyId: user.activeAgencyId,
      ownerId: user.id,
      contactId,
      destination: data.destination.trim(),
      days: data.days,
      travelers: data.travelers,
      budget: data.budget ?? null,
      travelType: data.travelType,
      startDate: data.startDate ? new Date(data.startDate) : null,
      pace: data.pace,
      hotelType: data.hotelType,
      interests: data.interests,
      notes: data.notes ?? null,
    },
  });

  await logActivity({
    // tripId always; contactId only when the trip was started from a contact.
    contactId: trip.contactId,
    tripId: trip.id,
    actorId: user.id,
    type: "TRIP_CREATED",
    title: `Trip created — ${trip.destination}`,
  });

  try {
    const content = await generateItineraryAI({
      destination: trip.destination,
      days: trip.days,
      travelType: trip.travelType,
      travelers: trip.travelers,
      budget: trip.budget,
      pace: trip.pace,
      hotelType: trip.hotelType,
      interests: trip.interests,
      notes: trip.notes,
    });
    await prisma.itinerary.create({
      data: {
        tripId: trip.id,
        version: 1,
        content: content as unknown as object,
      },
    });
  } catch (e) {
    console.error("itinerary generation failed", e);
  }

  revalidatePath("/");
  if (trip.contactId) revalidatePath(`/contacts/${trip.contactId}`);
  redirect(`/trips/${trip.id}`);
}

export async function updateTripStatusAction(
  tripId: string,
  status: "PLANNING" | "QUOTED" | "BOOKED" | "COMPLETED" | "CANCELLED"
) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");
  await prisma.trip.updateMany({
    where: { id: tripId, agencyId },
    data: { status },
  });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const };
}

export async function deleteTripAction(tripId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:delete");
  await prisma.trip.updateMany({
    where: { id: tripId, agencyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true as const };
}

/**
 * Assign (or clear) the operations owner of a trip — the staffer
 * responsible for executing it.
 */
export async function assignTripOwnerAction(input: {
  tripId: string;
  ownerId: string | null;
}) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");

  if (input.ownerId) {
    const member = await prisma.membership.findFirst({
      where: { agencyId, userId: input.ownerId },
      select: { id: true },
    });
    if (!member) {
      return { ok: false as const, error: "Not a member of this agency." };
    }
  }

  const res = await prisma.trip.updateMany({
    where: { id: input.tripId, agencyId },
    data: { ownerId: input.ownerId },
  });
  if (res.count === 0) return { ok: false as const, error: "Trip not found." };

  revalidatePath(`/trips/${input.tripId}`);
  return { ok: true as const };
}

/**
 * Link a trip to a CRM contact (contact) — or move it from one contact to
 * another. Both the trip and the contact must belong to the caller's agency.
 * Issued invoices freeze their own recipient snapshot, so back-linking
 * never mutates historical documents.
 */
export async function linkTripToLeadAction(input: {
  tripId: string;
  contactId: string;
}) {
  const { agencyId, user } = await requireAgency();
  await assertCan("trip:update");

  const [trip, contact] = await Promise.all([
    prisma.trip.findFirst({
      where: { id: input.tripId, agencyId, deletedAt: null },
      select: { id: true, contactId: true, destination: true },
    }),
    prisma.contact.findFirst({
      where: { id: input.contactId, agencyId, deletedAt: null },
      select: { id: true, name: true },
    }),
  ]);
  if (!trip) return { ok: false as const, error: "Trip not found." };
  if (!contact) return { ok: false as const, error: "Contact not found." };
  if (trip.contactId === contact.id) return { ok: true as const };

  const previousLeadId = trip.contactId;
  await prisma.trip.update({
    where: { id: trip.id },
    data: { contactId: contact.id },
  });

  await logActivity({
    contactId: contact.id,
    tripId: trip.id,
    actorId: user.id,
    type: "CUSTOM",
    title: previousLeadId
      ? "Trip re-linked to this contact"
      : "Trip linked to this contact",
    body: trip.destination,
  });

  revalidatePath(`/trips/${trip.id}`);
  revalidatePath(`/contacts/${contact.id}`);
  if (previousLeadId) revalidatePath(`/contacts/${previousLeadId}`);
  return { ok: true as const };
}

/** Detach a trip from its contact, leaving it standalone. */
export async function unlinkTripFromLeadAction(tripId: string) {
  const { agencyId, user } = await requireAgency();
  await assertCan("trip:update");

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId, deletedAt: null },
    select: { id: true, contactId: true },
  });
  if (!trip) return { ok: false as const, error: "Trip not found." };
  if (!trip.contactId) return { ok: true as const };

  await prisma.trip.update({
    where: { id: trip.id },
    data: { contactId: null },
  });

  await logActivity({
    contactId: trip.contactId,
    actorId: user.id,
    type: "CUSTOM",
    title: "Trip unlinked from this contact",
  });

  revalidatePath(`/trips/${trip.id}`);
  revalidatePath(`/contacts/${trip.contactId}`);
  return { ok: true as const };
}

export async function markTripStartedAction(tripId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
    select: { id: true, contactId: true, status: true },
  });
  if (!trip) throw new Error("Trip not found");
  if (trip.status === "IN_PROGRESS") return { ok: true as const };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "IN_PROGRESS" },
  });

  await logActivity({
    tripId,
    contactId: trip.contactId,
    type: "TRIP_STARTED",
    title: "Trip started",
    metadata: { from: trip.status, to: "IN_PROGRESS" },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/operations");
  return { ok: true as const };
}

export async function markTripCompletedAction(tripId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("trip:update");
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, agencyId },
    select: { id: true, contactId: true, status: true },
  });
  if (!trip) throw new Error("Trip not found");
  if (trip.status === "COMPLETED") return { ok: true as const };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "COMPLETED" },
  });

  await logActivity({
    tripId,
    contactId: trip.contactId,
    type: "TRIP_COMPLETED",
    title: "Trip completed",
    metadata: { from: trip.status, to: "COMPLETED" },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/operations");
  return { ok: true as const };
}
