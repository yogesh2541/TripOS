"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { logActivity } from "@/server/helpers/log-activity";

// A "customer" is no longer a separate record — it's a Contact whose
// `convertedAt` is set. These actions flip that flag and maintain the
// contact's free-form preferences.

const preferencesSchema = z
  .object({
    dietary: z.string().max(200).optional().nullable(),
    hotels: z.string().max(200).optional().nullable(),
    travelStyle: z.string().max(200).optional().nullable(),
    other: z.string().max(2000).optional().nullable(),
  })
  .partial();

const convertSchema = z.object({
  contactId: z.string(),
  preferences: preferencesSchema.optional(),
});

/** Mark a contact as a customer — sets `convertedAt` and moves it to WON. */
export async function convertLeadToCustomerAction(
  input: z.infer<typeof convertSchema>
) {
  const data = convertSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");

  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, agencyId, deletedAt: null },
    select: { id: true, status: true, convertedAt: true },
  });
  if (!contact) throw new Error("Contact not found");

  // Already a customer — just refresh preferences if any were passed.
  if (contact.convertedAt) {
    if (data.preferences) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { preferences: data.preferences as Prisma.InputJsonValue },
      });
    }
    revalidatePath(`/contacts/${contact.id}`);
    return { ok: true as const, contactId: contact.id };
  }

  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      convertedAt: new Date(),
      ...(data.preferences
        ? { preferences: data.preferences as Prisma.InputJsonValue }
        : {}),
      // Bump to WON unless already terminal.
      ...(contact.status !== "WON" && contact.status !== "LOST"
        ? { status: "WON" as const }
        : {}),
    },
  });

  await logActivity({
    contactId: contact.id,
    type: "STATUS_CHANGED",
    title: "Converted to customer",
    metadata: { from: contact.status, to: "WON" },
  });

  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/customers");
  revalidatePath("/contacts");
  return { ok: true as const, contactId: contact.id };
}

const updatePrefsSchema = z.object({
  contactId: z.string(),
  preferences: preferencesSchema,
});

/** Update a contact's free-form service preferences. */
export async function updateCustomerPreferencesAction(
  input: z.infer<typeof updatePrefsSchema>
) {
  const data = updatePrefsSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");

  const contact = await prisma.contact.findFirst({
    where: { id: data.contactId, agencyId, deletedAt: null },
    select: { id: true },
  });
  if (!contact) throw new Error("Contact not found");

  await prisma.contact.update({
    where: { id: contact.id },
    data: { preferences: data.preferences as Prisma.InputJsonValue },
  });
  revalidatePath(`/contacts/${contact.id}`);
  revalidatePath("/customers");
  return { ok: true as const };
}
