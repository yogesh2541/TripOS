"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  blankDay,
  generateItineraryAI,
  readDay,
  regenerateDayAI,
  suggestActivitiesAI,
  writeDay,
  type DayPlan,
  type ItineraryContent,
  type ItineraryDay,
} from "@/lib/ai";

function extractDayPlans(content: ItineraryContent | null): DayPlan[] {
  if (!content?.days) return [];
  return content.days.map((rawDay) => {
    const d = readDay(rawDay);
    return {
      city: d.city ?? null,
      hotel: d.hotel ?? null,
      roomType: d.roomType ?? null,
      mealPlan: d.mealPlan ?? null,
      activities: d.activities ?? [],
      inclusions: d.inclusions ?? [],
      exclusions: d.exclusions ?? [],
      transferNote: d.transferNote ?? null,
    };
  });
}

function mergeStructuredOntoAI(
  aiContent: ItineraryContent,
  existing: ItineraryContent | null
): ItineraryContent {
  if (!existing?.days) return aiContent;
  return {
    summary: aiContent.summary,
    days: aiContent.days.map((aiDay, i) => {
      const oldRaw = existing.days[i];
      if (!oldRaw) return aiDay;
      const old = readDay(oldRaw);
      // Keep agent's structured facts; AI may have re-emitted them, but the
      // agent's saved values win to prevent any drift.
      const merged: ItineraryDay = {
        ...aiDay,
        city: old.city ?? aiDay.city ?? null,
        hotel: old.hotel ?? aiDay.hotel ?? null,
        roomType: old.roomType ?? aiDay.roomType ?? null,
        mealPlan: old.mealPlan ?? aiDay.mealPlan ?? null,
        meals: old.meals && Object.keys(old.meals).length > 0 ? old.meals : aiDay.meals,
        activities:
          (old.activities && old.activities.length > 0
            ? old.activities
            : aiDay.activities) ?? [],
        inclusions: old.inclusions ?? aiDay.inclusions ?? [],
        exclusions: old.exclusions ?? aiDay.exclusions ?? [],
        transferNote: old.transferNote ?? aiDay.transferNote ?? null,
        imageUrl: old.imageUrl ?? aiDay.imageUrl ?? null,
      };
      return merged;
    }),
  };
}

/**
 * Normalize all days through writeDay() so the persisted blob is clean
 * (legacy fields stripped, arrays trimmed). Saves the DB from accumulating
 * stale shape over time.
 */
function normalizeContent(content: ItineraryContent): ItineraryContent {
  return {
    ...content,
    days: content.days.map((d) => writeDay(readDay(d))),
  };
}

export async function regenerateItineraryAction(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");

  const existing = await prisma.itinerary.findUnique({
    where: { tripId_version: { tripId, version: 1 } },
  });
  const existingContent = (existing?.content ?? null) as ItineraryContent | null;
  const dayPlans = extractDayPlans(existingContent);

  const aiContent = await generateItineraryAI({
    destination: trip.destination,
    days: trip.days,
    travelType: trip.travelType,
    travelers: trip.travelers,
    budget: trip.budget,
    pace: trip.pace,
    hotelType: trip.hotelType,
    interests: trip.interests,
    notes: trip.notes,
    dayPlans: dayPlans.length > 0 ? dayPlans : undefined,
  });

  const merged = normalizeContent(mergeStructuredOntoAI(aiContent, existingContent));

  if (existing) {
    await prisma.itinerary.update({
      where: { id: existing.id },
      data: { content: merged as unknown as object, isActive: true },
    });
  } else {
    await prisma.itinerary.create({
      data: {
        tripId,
        version: 1,
        content: merged as unknown as object,
      },
    });
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true as const };
}

export async function saveItineraryAction(
  tripId: string,
  content: ItineraryContent
) {
  const cleaned = normalizeContent(content);
  const existing = await prisma.itinerary.findUnique({
    where: { tripId_version: { tripId, version: 1 } },
  });
  if (existing) {
    await prisma.itinerary.update({
      where: { id: existing.id },
      data: { content: cleaned as unknown as object },
    });
  } else {
    await prisma.itinerary.create({
      data: {
        tripId,
        version: 1,
        content: cleaned as unknown as object,
      },
    });
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
  return { ok: true as const };
}

async function loadItinerary(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw new Error("Trip not found");
  const itin = await prisma.itinerary.findUnique({
    where: { tripId_version: { tripId, version: 1 } },
  });
  return { trip, itin };
}

async function writeItinerary(
  tripId: string,
  existingId: string | null,
  content: ItineraryContent
) {
  const cleaned = normalizeContent(content);
  if (existingId) {
    await prisma.itinerary.update({
      where: { id: existingId },
      data: { content: cleaned as unknown as object },
    });
  } else {
    await prisma.itinerary.create({
      data: { tripId, version: 1, content: cleaned as unknown as object },
    });
  }
}

export async function regenerateOneDayAction(tripId: string, dayIndex: number) {
  const { trip, itin } = await loadItinerary(tripId);
  if (!itin) throw new Error("Generate the itinerary first");
  const content = itin.content as unknown as ItineraryContent;
  if (!content?.days?.[dayIndex]) throw new Error("Day not found");

  const dayPlans = extractDayPlans(content);
  const currentDay = readDay(content.days[dayIndex]);

  const newDay = await regenerateDayAI(
    {
      destination: trip.destination,
      days: trip.days,
      travelType: trip.travelType,
      travelers: trip.travelers,
      budget: trip.budget,
      pace: trip.pace,
      hotelType: trip.hotelType,
      interests: trip.interests,
      notes: trip.notes,
      dayPlans,
    },
    dayIndex,
    currentDay
  );

  const updated: ItineraryContent = {
    ...content,
    days: content.days.map((d, i) => (i === dayIndex ? newDay : d)),
  };
  await writeItinerary(tripId, itin.id, updated);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
  return { ok: true as const };
}

export async function suggestActivitiesAction(
  tripId: string,
  dayIndex: number
): Promise<string[]> {
  const { trip, itin } = await loadItinerary(tripId);
  if (!itin) throw new Error("Generate the itinerary first");
  const content = itin.content as unknown as ItineraryContent;
  const rawDay = content.days[dayIndex];
  if (!rawDay) throw new Error("Day not found");
  const day = readDay(rawDay);

  return suggestActivitiesAI({
    city: day.city?.trim() || trip.destination,
    destination: trip.destination,
    travelType: trip.travelType,
    interests: trip.interests,
    excluding: day.activities ?? [],
  });
}

// Back-compat alias for older clients that still import the old name.
export const suggestSightsAction = suggestActivitiesAction;

export async function insertDayAction(tripId: string, position: number) {
  const { itin } = await loadItinerary(tripId);
  if (!itin) throw new Error("Generate the itinerary first");
  const content = itin.content as unknown as ItineraryContent;
  const days = [...content.days];
  const safePos = Math.max(0, Math.min(days.length, position));
  days.splice(safePos, 0, blankDay(safePos));
  const updated: ItineraryContent = { ...content, days };
  const cleaned = normalizeContent(updated);
  await prisma.$transaction([
    prisma.itinerary.update({
      where: { id: itin.id },
      data: { content: cleaned as unknown as object },
    }),
    prisma.trip.update({
      where: { id: tripId },
      data: { days: days.length },
    }),
  ]);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
  return { ok: true as const };
}

export async function removeDayAction(tripId: string, dayIndex: number) {
  const { itin } = await loadItinerary(tripId);
  if (!itin) throw new Error("Itinerary not found");
  const content = itin.content as unknown as ItineraryContent;
  if (content.days.length <= 1) {
    throw new Error("Can't delete the only day. Add another first.");
  }
  const days = content.days.filter((_, i) => i !== dayIndex);
  const updated: ItineraryContent = { ...content, days };
  const cleaned = normalizeContent(updated);
  await prisma.$transaction([
    prisma.itinerary.update({
      where: { id: itin.id },
      data: { content: cleaned as unknown as object },
    }),
    prisma.trip.update({
      where: { id: tripId },
      data: { days: days.length },
    }),
  ]);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
  return { ok: true as const };
}

export async function moveDayAction(
  tripId: string,
  fromIndex: number,
  toIndex: number
) {
  const { itin } = await loadItinerary(tripId);
  if (!itin) throw new Error("Itinerary not found");
  const content = itin.content as unknown as ItineraryContent;
  const days = [...content.days];
  if (
    fromIndex < 0 ||
    fromIndex >= days.length ||
    toIndex < 0 ||
    toIndex >= days.length
  ) {
    return { ok: true as const };
  }
  const [moved] = days.splice(fromIndex, 1);
  days.splice(toIndex, 0, moved);
  const updated: ItineraryContent = { ...content, days };
  await writeItinerary(tripId, itin.id, updated);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/preview`);
  return { ok: true as const };
}
