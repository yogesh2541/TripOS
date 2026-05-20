"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createOrRefreshDraftInvoice,
  issueInvoice,
  cancelInvoice,
  updateDraftInvoice,
} from "@/server/services/invoices";

const TAX_SCHEMES = ["GST_5_NO_ITC", "GST_18_REGULAR", "EXEMPT"] as const;
const BASES = ["FULL_AMOUNT", "SERVICE_FEE_ONLY", "MARGIN_ONLY"] as const;

const createSchema = z.object({
  bookingId: z.string(),
  scheme: z.enum(TAX_SCHEMES).optional(),
  basis: z.enum(BASES).optional(),
  placeOfSupplyState: z.string().optional().nullable(),
  placeOfSupplyStateCode: z.string().optional().nullable(),
});

export async function createDraftInvoiceAction(
  input: z.infer<typeof createSchema>
) {
  const data = createSchema.parse(input);
  const invoice = await createOrRefreshDraftInvoice({
    bookingId: data.bookingId,
    scheme: data.scheme,
    basis: data.basis,
    placeOfSupplyState: data.placeOfSupplyState,
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
  });
  revalidatePath("/invoices");
  return { id: invoice.id, status: invoice.status };
}

export async function issueInvoiceAction(invoiceId: string) {
  const invoice = await issueInvoice(invoiceId);
  revalidatePath("/invoices");
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    fiscalYear: invoice.invoiceFy,
  };
}

const cancelSchema = z.object({
  invoiceId: z.string(),
  reason: z.string().min(1, "Cancellation reason is required").max(2000),
});

export async function cancelInvoiceAction(input: z.infer<typeof cancelSchema>) {
  const data = cancelSchema.parse(input);
  await cancelInvoice(data.invoiceId, data.reason);
  revalidatePath("/invoices");
  return { ok: true as const };
}

const lineSchema = z.object({
  description: z.string().min(1).max(400),
  sacCode: z.string().min(2).max(10),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  cost: z.coerce.number().min(0).optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
});

const updateSchema = z.object({
  invoiceId: z.string(),
  scheme: z.enum(TAX_SCHEMES).optional(),
  basis: z.enum(BASES).optional(),
  placeOfSupplyState: z.string().optional().nullable(),
  placeOfSupplyStateCode: z.string().optional().nullable(),
  invoiceDate: z.string().optional(),
  lines: z.array(lineSchema).min(1).optional(),
});

export async function updateDraftInvoiceAction(
  input: z.infer<typeof updateSchema>
) {
  const data = updateSchema.parse(input);
  const invoice = await updateDraftInvoice({
    invoiceId: data.invoiceId,
    scheme: data.scheme,
    basis: data.basis,
    placeOfSupplyState: data.placeOfSupplyState,
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
    lines: data.lines?.map((l) => ({
      description: l.description,
      sacCode: l.sacCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      cost: l.cost ?? null,
      position: l.position,
    })),
  });
  revalidatePath(`/invoices/${invoice.id}`);
  revalidatePath("/invoices");
  return { ok: true as const, grandTotal: invoice.grandTotal };
}
