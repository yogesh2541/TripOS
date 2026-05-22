"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { logActivity } from "@/server/helpers/log-activity";

const LEAD_SOURCES = [
  "MANUAL",
  "INSTAGRAM",
  "REFERRAL",
  "WEBSITE",
  "WHATSAPP",
  "GOOGLE",
  "OTHER",
] as const;

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "REQUIREMENT_UNDERSTOOD",
  "QUOTED",
  "FOLLOW_UP",
  "WON",
  "LOST",
] as const;

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  source: z.enum(LEAD_SOURCES).default("MANUAL"),
  destination: z.string().max(120).optional().nullable(),
  travelStartDate: z.string().optional().nullable(),
  travelEndDate: z.string().optional().nullable(),
  adults: z.coerce.number().int().min(1).max(40).default(1),
  budget: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  // Billing identity — optional at contact time; usable as the recipient default
  // when generating tax invoices.
  gstin: z.string().max(20).optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export async function createLeadAction(input: CreateLeadInput) {
  const data = createLeadSchema.parse(input);
  const user = await assertCan("contact:create");

  const contact = await prisma.contact.create({
    data: {
      agencyId: user.activeAgencyId,
      ownerId: user.id,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      source: data.source,
      destination: data.destination?.trim() || null,
      travelStartDate: data.travelStartDate
        ? new Date(data.travelStartDate)
        : null,
      travelEndDate: data.travelEndDate ? new Date(data.travelEndDate) : null,
      adults: data.adults,
      budget: data.budget ?? null,
      notes: data.notes ?? null,
      gstin: data.gstin?.trim().toUpperCase() || null,
    },
  });

  await logActivity({
    contactId: contact.id,
    actorId: user.id,
    type: "STATUS_CHANGED",
    title: "Contact created",
    metadata: { from: null, to: "NEW", source: data.source },
  });

  revalidatePath("/contacts");
  revalidatePath("/");
  return { id: contact.id };
}

export async function updateLeadStatusAction(
  contactId: string,
  status: (typeof LEAD_STATUSES)[number]
) {
  const user = await assertCan("contact:update");
  const current = await prisma.contact.findFirst({
    where: { id: contactId, agencyId: user.activeAgencyId },
    select: { status: true },
  });
  if (!current) throw new Error("Contact not found");
  if (current.status === status) return { ok: true as const };

  await prisma.contact.update({
    where: { id: contactId },
    data: { status },
  });

  await logActivity({
    contactId,
    actorId: user.id,
    type: "STATUS_CHANGED",
    title: `Status changed: ${current.status} → ${status}`,
    metadata: { from: current.status, to: status },
  });

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  return { ok: true as const };
}

const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(LEAD_STATUSES).optional(),
  nextFollowUpAt: z.string().optional().nullable(),
  lostReason: z.string().max(400).optional().nullable(),
});

export async function updateLeadAction(
  contactId: string,
  patch: z.infer<typeof updateLeadSchema>
) {
  const data = updateLeadSchema.parse(patch);
  const { agencyId } = await requireAgency();
  await assertCan("contact:update");

  const exists = await prisma.contact.findFirst({
    where: { id: contactId, agencyId },
    select: { id: true },
  });
  if (!exists) throw new Error("Contact not found");

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      name: data.name?.trim(),
      phone: data.phone === undefined ? undefined : data.phone?.trim() || null,
      email: data.email === undefined ? undefined : data.email?.trim() || null,
      source: data.source,
      destination:
        data.destination === undefined
          ? undefined
          : data.destination?.trim() || null,
      travelStartDate:
        data.travelStartDate === undefined
          ? undefined
          : data.travelStartDate
            ? new Date(data.travelStartDate)
            : null,
      travelEndDate:
        data.travelEndDate === undefined
          ? undefined
          : data.travelEndDate
            ? new Date(data.travelEndDate)
            : null,
      adults: data.adults,
      budget: data.budget === undefined ? undefined : (data.budget ?? null),
      notes: data.notes === undefined ? undefined : (data.notes ?? null),
      status: data.status,
      nextFollowUpAt:
        data.nextFollowUpAt === undefined
          ? undefined
          : data.nextFollowUpAt
            ? new Date(data.nextFollowUpAt)
            : null,
      lostReason:
        data.lostReason === undefined ? undefined : (data.lostReason ?? null),
    },
  });

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  return { ok: true as const };
}

export async function softDeleteLeadAction(contactId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("contact:delete");
  await prisma.contact.updateMany({
    where: { id: contactId, agencyId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/contacts");
  return { ok: true as const };
}

/**
 * Assign (or clear, with null) the owner of a single contact. The owner must
 * be a member of the same agency.
 */
export async function assignLeadOwnerAction(input: {
  contactId: string;
  ownerId: string | null;
}) {
  const { agencyId } = await requireAgency();
  await assertCan("contact:assign");

  if (input.ownerId) {
    const member = await prisma.membership.findFirst({
      where: { agencyId, userId: input.ownerId },
      select: { id: true },
    });
    if (!member) {
      return { ok: false as const, error: "Not a member of this agency." };
    }
  }

  const res = await prisma.contact.updateMany({
    where: { id: input.contactId, agencyId },
    data: { ownerId: input.ownerId },
  });
  if (res.count === 0) return { ok: false as const, error: "Contact not found." };

  revalidatePath(`/contacts/${input.contactId}`);
  revalidatePath("/contacts");
  return { ok: true as const };
}

// === Bulk operations ===

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(200),
  // Exactly one operation per call.
  op: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("status"), status: z.enum(LEAD_STATUSES) }),
    z.object({ kind: z.literal("assign"), ownerId: z.string().nullable() }),
    z.object({ kind: z.literal("delete") }),
  ]),
});

/**
 * Apply one operation to many leads at once. Every id is re-scoped to the
 * caller's agency via `updateMany`, so a forged id from another tenant is
 * silently skipped rather than mutated.
 */
export async function bulkUpdateLeadsAction(
  input: z.infer<typeof bulkSchema>
) {
  const data = bulkSchema.parse(input);
  const { agencyId } = await requireAgency();

  if (data.op.kind === "delete") {
    await assertCan("contact:delete");
    const res = await prisma.contact.updateMany({
      where: { id: { in: data.ids }, agencyId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/contacts");
    return { ok: true as const, count: res.count };
  }

  if (data.op.kind === "assign") {
    await assertCan("contact:assign");
    // Validate the new owner is a member of this agency (or null = unassign).
    if (data.op.ownerId) {
      const member = await prisma.membership.findFirst({
        where: { agencyId, userId: data.op.ownerId },
        select: { id: true },
      });
      if (!member) {
        return {
          ok: false as const,
          error: "That teammate isn't on this agency.",
        };
      }
    }
    const res = await prisma.contact.updateMany({
      where: { id: { in: data.ids }, agencyId },
      data: { ownerId: data.op.ownerId },
    });
    revalidatePath("/contacts");
    return { ok: true as const, count: res.count };
  }

  // status
  await assertCan("contact:update");
  const res = await prisma.contact.updateMany({
    where: { id: { in: data.ids }, agencyId },
    data: { status: data.op.status },
  });
  revalidatePath("/contacts");
  return { ok: true as const, count: res.count };
}
