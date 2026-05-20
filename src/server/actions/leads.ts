"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";
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
  // Billing identity — optional at lead time; usable as the recipient default
  // when generating tax invoices.
  gstin: z.string().max(20).optional().nullable(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export async function createLeadAction(input: CreateLeadInput) {
  const data = createLeadSchema.parse(input);
  const user = await getOrCreateDemoUser();

  const lead = await prisma.lead.create({
    data: {
      userId: user.id,
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
    leadId: lead.id,
    type: "STATUS_CHANGED",
    title: "Lead created",
    metadata: { from: null, to: "NEW", source: data.source },
  });

  revalidatePath("/leads");
  revalidatePath("/");
  return { id: lead.id };
}

export async function updateLeadStatusAction(
  leadId: string,
  status: (typeof LEAD_STATUSES)[number]
) {
  const current = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { status: true },
  });
  if (!current) throw new Error("Lead not found");
  if (current.status === status) return { ok: true as const };

  await prisma.lead.update({
    where: { id: leadId },
    data: { status },
  });

  await logActivity({
    leadId,
    type: "STATUS_CHANGED",
    title: `Status changed: ${current.status} → ${status}`,
    metadata: { from: current.status, to: status },
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(LEAD_STATUSES).optional(),
  nextFollowUpAt: z.string().optional().nullable(),
  lostReason: z.string().max(400).optional().nullable(),
});

export async function updateLeadAction(
  leadId: string,
  patch: z.infer<typeof updateLeadSchema>
) {
  const data = updateLeadSchema.parse(patch);

  await prisma.lead.update({
    where: { id: leadId },
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

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true as const };
}

export async function softDeleteLeadAction(leadId: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/leads");
  return { ok: true as const };
}
