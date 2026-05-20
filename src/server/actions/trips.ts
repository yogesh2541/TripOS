"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";
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
  leadId: z.string().optional().nullable(),
});

export type CreateTripInput = z.infer<typeof tripSchema>;

export async function createTripAction(input: CreateTripInput) {
  const data = tripSchema.parse(input);
  const user = await getOrCreateDemoUser();

  // Standalone trips still get a Lead so every trip is CRM-trackable.
  let leadId = data.leadId ?? null;
  if (!leadId) {
    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = startDate
      ? new Date(startDate.getTime() + data.days * 24 * 60 * 60 * 1000)
      : null;
    const directLead = await prisma.lead.create({
      data: {
        userId: user.id,
        name: `Direct — ${data.destination.trim()}`,
        source: "MANUAL",
        status: "REQUIREMENT_UNDERSTOOD",
        destination: data.destination.trim(),
        travelStartDate: startDate,
        travelEndDate: endDate,
        adults: data.travelers,
        budget: data.budget ?? null,
        notes: data.notes ?? null,
      },
    });
    leadId = directLead.id;
  }

  const trip = await prisma.trip.create({
    data: {
      userId: user.id,
      leadId,
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
    leadId: trip.leadId!,
    type: "TRIP_CREATED",
    title: `Trip created — ${trip.destination}`,
    metadata: { tripId: trip.id },
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
  if (trip.leadId) revalidatePath(`/leads/${trip.leadId}`);
  redirect(`/trips/${trip.id}`);
}

export async function updateTripStatusAction(
  tripId: string,
  status: "PLANNING" | "QUOTED" | "BOOKED" | "COMPLETED" | "CANCELLED"
) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { status },
  });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const };
}

export async function deleteTripAction(tripId: string) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/");
  return { ok: true as const };
}

export async function markTripStartedAction(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, leadId: true, status: true },
  });
  if (!trip) throw new Error("Trip not found");
  if (trip.status === "IN_PROGRESS") return { ok: true as const };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "IN_PROGRESS" },
  });

  await logActivity({
    tripId,
    leadId: trip.leadId,
    type: "TRIP_STARTED",
    title: "Trip started",
    metadata: { from: trip.status, to: "IN_PROGRESS" },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/operations");
  return { ok: true as const };
}

export async function markTripCompletedAction(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, leadId: true, status: true },
  });
  if (!trip) throw new Error("Trip not found");
  if (trip.status === "COMPLETED") return { ok: true as const };

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: "COMPLETED" },
  });

  await logActivity({
    tripId,
    leadId: trip.leadId,
    type: "TRIP_COMPLETED",
    title: "Trip completed",
    metadata: { from: trip.status, to: "COMPLETED" },
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/operations");
  return { ok: true as const };
}
