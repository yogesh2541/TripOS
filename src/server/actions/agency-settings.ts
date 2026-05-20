"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { upsertAgencySettings } from "@/server/services/agency-settings";

const TAX_SCHEMES = ["GST_5_NO_ITC", "GST_18_REGULAR", "EXEMPT"] as const;
const BASES = ["FULL_AMOUNT", "SERVICE_FEE_ONLY", "MARGIN_ONLY"] as const;

const optStr = (max = 200) =>
  z.string().max(max).optional().nullable().transform((v) => {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  });

const schema = z.object({
  legalName: z.string().min(2, "Legal name is required").max(160),
  tradeName: optStr(160),
  gstin: optStr(20),
  pan: optStr(15),
  logoUrl: optStr(500),

  addressLine1: optStr(200),
  addressLine2: optStr(200),
  city: optStr(80),
  state: optStr(80),
  stateCode: optStr(4),
  pincode: optStr(10),
  country: z.string().min(1).max(80).default("India"),

  phone: optStr(40),
  email: optStr(120),
  website: optStr(200),

  authorizedSignatory: optStr(120),
  signatoryDesignation: optStr(80),

  invoicePrefix: z
    .string()
    .min(1, "Prefix is required")
    .max(10, "Keep prefix short (≤10 chars)")
    .regex(/^[A-Z0-9_-]+$/i, "Use letters, digits, _ or - only"),
  defaultTaxScheme: z.enum(TAX_SCHEMES).default("GST_5_NO_ITC"),
  defaultTaxableBasis: z.enum(BASES).default("FULL_AMOUNT"),
  defaultSacCode: z
    .string()
    .min(4, "SAC code is required")
    .max(10),
  defaultPlaceOfSupplyState: optStr(80),
  defaultPlaceOfSupplyStateCode: optStr(4),

  bankName: optStr(120),
  bankAccountNumber: optStr(40),
  bankIfscCode: optStr(20),
  bankAccountHolder: optStr(120),

  invoiceTerms: optStr(2000),
  invoiceNotes: optStr(2000),

  eInvoiceEnabled: z.boolean().default(false),
  eWayBillEnabled: z.boolean().default(false),
});

export type AgencySettingsInput = z.input<typeof schema>;

export async function saveAgencySettingsAction(input: AgencySettingsInput) {
  const data = schema.parse(input);
  await upsertAgencySettings({
    legalName: data.legalName.trim(),
    tradeName: data.tradeName,
    gstin: data.gstin,
    pan: data.pan,
    logoUrl: data.logoUrl,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    city: data.city,
    state: data.state,
    stateCode: data.stateCode,
    pincode: data.pincode,
    country: data.country,
    phone: data.phone,
    email: data.email,
    website: data.website,
    authorizedSignatory: data.authorizedSignatory,
    signatoryDesignation: data.signatoryDesignation,
    invoicePrefix: data.invoicePrefix.toUpperCase(),
    defaultTaxScheme: data.defaultTaxScheme,
    defaultTaxableBasis: data.defaultTaxableBasis,
    defaultSacCode: data.defaultSacCode,
    defaultPlaceOfSupplyState: data.defaultPlaceOfSupplyState,
    defaultPlaceOfSupplyStateCode: data.defaultPlaceOfSupplyStateCode,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfscCode: data.bankIfscCode,
    bankAccountHolder: data.bankAccountHolder,
    invoiceTerms: data.invoiceTerms,
    invoiceNotes: data.invoiceNotes,
    eInvoiceEnabled: data.eInvoiceEnabled,
    eWayBillEnabled: data.eWayBillEnabled,
  });
  revalidatePath("/settings/agency");
  return { ok: true as const };
}
