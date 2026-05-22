"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { logActivity } from "@/server/helpers/log-activity";

const noteSchema = z.object({
  contactId: z.string(),
  body: z.string().min(1).max(4000),
});

/**
 * Confirms the contact belongs to the caller's agency before logging — stops
 * a forged contactId from writing an activity into another tenant's timeline.
 */
async function assertLeadInAgency(contactId: string, agencyId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, agencyId },
    select: { id: true },
  });
  if (!contact) throw new Error("Contact not found");
}

export async function addNoteAction(input: z.infer<typeof noteSchema>) {
  const data = noteSchema.parse(input);
  const user = await assertCan("contact:update");
  await assertLeadInAgency(data.contactId, user.activeAgencyId);
  await logActivity({
    contactId: data.contactId,
    actorId: user.id,
    type: "NOTE",
    title: "Note added",
    body: data.body.trim(),
  });
  revalidatePath(`/contacts/${data.contactId}`);
  return { ok: true as const };
}

const callSchema = z.object({
  contactId: z.string(),
  body: z.string().max(2000).optional().nullable(),
});

export async function logCallAction(input: z.infer<typeof callSchema>) {
  const data = callSchema.parse(input);
  const { user, agencyId } = await requireAgency();
  await assertLeadInAgency(data.contactId, agencyId);
  await logActivity({
    contactId: data.contactId,
    actorId: user.id,
    type: "CALL",
    title: "Call logged",
    body: data.body?.trim() || null,
  });
  revalidatePath(`/contacts/${data.contactId}`);
  return { ok: true as const };
}

export async function logWhatsAppAction(input: z.infer<typeof callSchema>) {
  const data = callSchema.parse(input);
  const { user, agencyId } = await requireAgency();
  await assertLeadInAgency(data.contactId, agencyId);
  await logActivity({
    contactId: data.contactId,
    actorId: user.id,
    type: "WHATSAPP",
    title: "WhatsApp message",
    body: data.body?.trim() || null,
  });
  revalidatePath(`/contacts/${data.contactId}`);
  return { ok: true as const };
}
