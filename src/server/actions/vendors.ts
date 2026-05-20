"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/helpers/log-activity";

const VENDOR_TYPES = [
  "HOTEL",
  "TRANSPORT",
  "DRIVER",
  "GUIDE",
  "ACTIVITY",
  "DMC",
  "OTHER",
] as const;

const optionalString = (max: number) =>
  z.string().max(max).optional().nullable().transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

const vendorBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  type: z.enum(VENDOR_TYPES).default("OTHER"),
  phone: optionalString(40),
  whatsapp: optionalString(40),
  email: optionalString(120),
  address: optionalString(400),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  gstNumber: optionalString(40),
  paymentTerms: optionalString(200),
  notes: optionalString(2000),
  isPreferred: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type VendorFormInput = z.input<typeof vendorBaseSchema>;

export async function createVendorAction(input: VendorFormInput) {
  const data = vendorBaseSchema.parse(input);

  const vendor = await prisma.vendor.create({
    data: {
      name: data.name.trim(),
      type: data.type,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      gstNumber: data.gstNumber,
      paymentTerms: data.paymentTerms,
      notes: data.notes,
      isPreferred: data.isPreferred,
      isActive: data.isActive,
    },
  });

  await logActivity({
    vendorId: vendor.id,
    type: "CUSTOM",
    title: "Vendor added",
    metadata: { type: vendor.type },
  });

  revalidatePath("/vendors");
  return { id: vendor.id };
}

export async function updateVendorAction(
  vendorId: string,
  input: VendorFormInput
) {
  const data = vendorBaseSchema.parse(input);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name: data.name.trim(),
      type: data.type,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      gstNumber: data.gstNumber,
      paymentTerms: data.paymentTerms,
      notes: data.notes,
      isPreferred: data.isPreferred,
      isActive: data.isActive,
    },
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true as const };
}

export async function togglePreferredVendorAction(
  vendorId: string,
  preferred: boolean
) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { isPreferred: preferred },
  });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true as const };
}

export async function toggleVendorActiveAction(
  vendorId: string,
  active: boolean
) {
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { isActive: active },
  });
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  return { ok: true as const };
}

export async function softDeleteVendorAction(vendorId: string) {
  // block delete if there are non-cancelled assignments
  const open = await prisma.vendorAssignment.count({
    where: {
      vendorId,
      status: { not: "CANCELLED" },
    },
  });
  if (open > 0) {
    throw new Error(
      "This vendor has live assignments. Cancel or reassign them before archiving."
    );
  }

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/vendors");
  return { ok: true as const };
}

const noteSchema = z.object({
  vendorId: z.string(),
  body: z.string().min(1).max(4000),
});

export async function addVendorNoteAction(input: z.infer<typeof noteSchema>) {
  const data = noteSchema.parse(input);
  await logActivity({
    vendorId: data.vendorId,
    type: "NOTE",
    title: "Note added",
    body: data.body.trim(),
  });
  revalidatePath(`/vendors/${data.vendorId}`);
  return { ok: true as const };
}
