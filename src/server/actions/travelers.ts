"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";

// An empty string from a form field means "cleared" — coerce to null.
const optDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? new Date(v) : null));
const optStr = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const loyaltySchema = z
  .array(
    z.object({
      program: z.string().max(80),
      number: z.string().max(60),
    })
  )
  .optional()
  .nullable();

const travelerSchema = z.object({
  contactId: z.string(),
  fullName: z.string().min(1, "Name is required").max(120),
  relationship: z
    .enum([
      "SELF",
      "SPOUSE",
      "CHILD",
      "PARENT",
      "SIBLING",
      "FRIEND",
      "COLLEAGUE",
      "OTHER",
    ])
    .default("OTHER"),
  isPrimary: z.boolean().default(false),
  dateOfBirth: optDate,
  gender: optStr(20),
  nationality: optStr(60),
  passportNumber: optStr(40),
  passportExpiry: optDate,
  passportIssueCountry: optStr(60),
  visaNotes: optStr(500),
  dietary: optStr(200),
  loyaltyNumbers: loyaltySchema,
  phone: optStr(30),
  email: optStr(120),
  notes: optStr(1000),
});

export type TravelerInput = z.input<typeof travelerSchema>;

/**
 * Confirms the contact exists and belongs to the caller's agency — the single
 * tenancy fence for every traveler mutation.
 */
async function requireLead(contactId: string, agencyId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, agencyId, deletedAt: null },
    select: { id: true },
  });
  if (!contact) throw new Error("Contact not found");
  return contact;
}

function toData(d: z.infer<typeof travelerSchema>) {
  return {
    fullName: d.fullName.trim(),
    relationship: d.relationship,
    isPrimary: d.isPrimary,
    dateOfBirth: d.dateOfBirth,
    gender: d.gender,
    nationality: d.nationality,
    passportNumber: d.passportNumber,
    passportExpiry: d.passportExpiry,
    passportIssueCountry: d.passportIssueCountry,
    visaNotes: d.visaNotes,
    dietary: d.dietary,
    loyaltyNumbers: (d.loyaltyNumbers && d.loyaltyNumbers.length > 0
      ? d.loyaltyNumbers
      : Prisma.JsonNull) as Prisma.InputJsonValue,
    phone: d.phone,
    email: d.email,
    notes: d.notes,
  };
}

export async function createTravelerAction(input: TravelerInput) {
  const data = travelerSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");
  await requireLead(data.contactId, agencyId);

  // A contact has at most one primary traveller — demote any existing one.
  if (data.isPrimary) {
    await prisma.traveler.updateMany({
      where: { contactId: data.contactId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const traveler = await prisma.traveler.create({
    data: { contactId: data.contactId, ...toData(data) },
  });
  revalidatePath(`/contacts/${data.contactId}`);
  return { id: traveler.id };
}

export async function updateTravelerAction(
  travelerId: string,
  input: TravelerInput
) {
  const data = travelerSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");

  const existing = await prisma.traveler.findUnique({
    where: { id: travelerId },
    select: { id: true, contactId: true },
  });
  if (!existing) throw new Error("Traveller not found");
  await requireLead(existing.contactId, agencyId);

  if (data.isPrimary) {
    await prisma.traveler.updateMany({
      where: { contactId: existing.contactId, isPrimary: true, id: { not: travelerId } },
      data: { isPrimary: false },
    });
  }

  await prisma.traveler.update({
    where: { id: travelerId },
    data: toData(data),
  });
  revalidatePath(`/contacts/${existing.contactId}`);
  return { ok: true as const };
}

export async function deleteTravelerAction(travelerId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");

  const existing = await prisma.traveler.findUnique({
    where: { id: travelerId },
    select: { id: true, contactId: true },
  });
  if (!existing) throw new Error("Traveller not found");
  await requireLead(existing.contactId, agencyId);

  await prisma.traveler.delete({ where: { id: travelerId } });
  revalidatePath(`/contacts/${existing.contactId}`);
  return { ok: true as const };
}
