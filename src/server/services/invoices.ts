import "server-only";
import type {
  Invoice,
  InvoiceTaxScheme,
  Prisma,
  TaxableBasis,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateNextInvoiceNumber } from "@/server/services/invoice-numbering";
import {
  computeInvoiceTaxes,
  type TaxComputationLineInput,
} from "@/server/services/invoice-tax";
import { amountInWordsINR } from "@/lib/gst";

export type DraftInvoiceLine = {
  description: string;
  sacCode?: string;
  quantity?: number;
  unitPrice: number;
  cost?: number | null;
  position?: number;
};

/**
 * Distribute a booking's selling total across its quote line items, pro-rata
 * to each item's cost — so the marked-up price is spread invisibly across the
 * lines (no separate "markup" figure) and the lines sum *exactly* to the
 * selling total. Each line keeps its true `cost` for the operator margin view.
 */
function sellingLinesFromQuote(
  items: { category: string; label: string; cost: number }[],
  sellingTotal: number,
  defaultSacCode: string
): DraftInvoiceLine[] {
  const selling = Math.round(sellingTotal);
  const totalCost = items.reduce((s, it) => s + (it.cost || 0), 0);
  const shares = items.map((it) =>
    totalCost > 0
      ? Math.round(((it.cost || 0) / totalCost) * selling)
      : Math.round(selling / items.length)
  );
  // Absorb the rounding residual into the largest line so the lines tie out
  // to the selling total to the rupee.
  const summed = shares.reduce((a, b) => a + b, 0);
  const residual = selling - summed;
  if (residual !== 0 && shares.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < shares.length; i++) {
      if (shares[i] > shares[maxIdx]) maxIdx = i;
    }
    shares[maxIdx] += residual;
  }
  return items.map((it, i) => ({
    description: `${it.category} — ${it.label}`,
    sacCode: defaultSacCode,
    quantity: 1,
    unitPrice: shares[i],
    cost: it.cost,
    position: i,
  }));
}

export type CreateDraftInvoiceInput = {
  bookingId: string;
  lines?: DraftInvoiceLine[]; // if omitted, derived from the booking's quote
  scheme?: InvoiceTaxScheme;
  basis?: TaxableBasis;
  placeOfSupplyState?: string | null;
  placeOfSupplyStateCode?: string | null;
  invoiceDate?: Date;
};

/**
 * Builds (or rebuilds) a DRAFT invoice for a booking, snapshotting the
 * supplier and recipient, deriving line items from the booking's accepted
 * quote when none are supplied, and computing taxes.
 *
 * Idempotent: if a DRAFT already exists, it's updated in place. ISSUED /
 * CANCELLED invoices are left alone — recreate via Phase B's "create new"
 * flow if needed.
 */
export async function createOrRefreshDraftInvoice(
  input: CreateDraftInvoiceInput
): Promise<Invoice> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      trip: {
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              gstin: true,
              billingName: true,
              billingAddress: true,
              billingCity: true,
              billingState: true,
              billingStateCode: true,
              billingPincode: true,
            },
          },
        },
      },
      quote: { include: { items: true } },
    },
  });
  if (!booking) throw new Error("Booking not found");

  const settings = await prisma.agencySettings.findUnique({
    where: { agencyId: booking.trip.agencyId },
  });
  if (!settings) {
    throw new Error(
      "Agency settings not configured. Open Settings → Agency to add your GSTIN before issuing invoices."
    );
  }

  // Resolve config with sensible fallbacks
  const scheme = input.scheme ?? settings.defaultTaxScheme;
  const basis = input.basis ?? settings.defaultTaxableBasis;
  const placeOfSupplyState =
    input.placeOfSupplyState ??
    settings.defaultPlaceOfSupplyState ??
    settings.state ??
    null;
  const placeOfSupplyStateCode =
    input.placeOfSupplyStateCode ??
    settings.defaultPlaceOfSupplyStateCode ??
    settings.stateCode ??
    null;

  // Derive lines: explicit override → quote items → single-line fallback.
  //
  // The CLIENT invoice must bill the *selling* price (cost + markup). The
  // booking total already carries the quote's markup + discount, so we
  // distribute it across the quote's line items pro-rata to each item's
  // cost. The markup is thereby baked into every unitPrice and never appears
  // as its own figure — invisible to the client. Each line still records its
  // true `cost`, which powers the operator-only margin view (and the
  // margin-scheme tax). This mirrors buildProposalPricing's pro-rata so the
  // invoice total matches the proposal the client accepted.
  const lines: DraftInvoiceLine[] =
    input.lines && input.lines.length > 0
      ? input.lines
      : booking.quote.items.length > 0
        ? sellingLinesFromQuote(
            booking.quote.items,
            booking.totalAmount,
            settings.defaultSacCode
          )
        : [
            {
              description: `Travel package — ${booking.trip.destination}`,
              sacCode: settings.defaultSacCode,
              quantity: 1,
              unitPrice: booking.totalAmount,
              cost: null,
              position: 0,
            },
          ];

  // Compute taxes with the dedicated service
  const taxInput: TaxComputationLineInput[] = lines.map((l) => ({
    description: l.description,
    sacCode: l.sacCode ?? settings.defaultSacCode,
    quantity: l.quantity ?? 1,
    unitPrice: l.unitPrice,
    cost: l.cost ?? null,
  }));
  const computed = computeInvoiceTaxes({
    scheme,
    basis,
    supplierStateCode: settings.stateCode,
    placeOfSupplyStateCode,
    lines: taxInput,
  });

  // Snapshots — frozen onto the invoice so historical reads remain correct
  const supplierSnapshot = {
    legalName: settings.legalName,
    tradeName: settings.tradeName,
    gstin: settings.gstin,
    pan: settings.pan,
    address: {
      line1: settings.addressLine1,
      line2: settings.addressLine2,
      city: settings.city,
      state: settings.state,
      stateCode: settings.stateCode,
      pincode: settings.pincode,
      country: settings.country,
    },
    contact: {
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
    },
    signatory: {
      name: settings.authorizedSignatory,
      designation: settings.signatoryDesignation,
    },
    bank: {
      name: settings.bankName,
      accountNumber: settings.bankAccountNumber,
      ifsc: settings.bankIfscCode,
      holder: settings.bankAccountHolder,
    },
    invoiceTerms: settings.invoiceTerms,
    invoiceNotes: settings.invoiceNotes,
  };

  const contact = booking.trip.contact;
  const recipientSnapshot = {
    contactId: contact?.id ?? null,
    name: contact?.billingName?.trim() || contact?.name || "Walk-in customer",
    gstin: contact?.gstin ?? null,
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    address: {
      line1: contact?.billingAddress ?? null,
      city: contact?.billingCity ?? null,
      state: contact?.billingState ?? placeOfSupplyState,
      stateCode: contact?.billingStateCode ?? placeOfSupplyStateCode,
      pincode: contact?.billingPincode ?? null,
    },
  };

  const data: Prisma.InvoiceUncheckedCreateInput = {
    agencyId: booking.trip.agencyId,
    bookingId: booking.id,
    status: "DRAFT",
    invoiceDate: input.invoiceDate ?? new Date(),
    taxScheme: scheme,
    taxRatePct: computed.taxRatePct,
    taxableBasis: basis,
    placeOfSupplyState: placeOfSupplyState,
    placeOfSupplyStateCode: placeOfSupplyStateCode,
    supplierSnapshot: supplierSnapshot as never,
    recipientSnapshot: recipientSnapshot as never,
    subtotal: computed.subtotal,
    cgstAmount: computed.cgstAmount,
    sgstAmount: computed.sgstAmount,
    igstAmount: computed.igstAmount,
    taxTotal: computed.taxTotal,
    roundOff: computed.roundOff,
    grandTotal: computed.grandTotal,
    amountInWords: amountInWordsINR(computed.grandTotal),
    items: {
      create: computed.lines.map((l, i) => ({
        position: lines[i]?.position ?? i,
        description: l.description,
        sacCode: l.sacCode,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        cost: l.cost ?? null,
        taxableValue: l.taxableValue,
        taxRatePct: l.taxRatePct,
        cgstAmount: l.cgstAmount,
        sgstAmount: l.sgstAmount,
        igstAmount: l.igstAmount,
      })),
    },
  };

  // Upsert keyed by bookingId (1:1)
  const existing = await prisma.invoice.findUnique({
    where: { bookingId: booking.id },
  });

  if (!existing) {
    return prisma.invoice.create({ data });
  }
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Invoice ${existing.invoiceNumber ?? existing.id} is ${existing.status}; recreate via Phase B's new-invoice flow.`
    );
  }

  // Replace items + reset totals
  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    return tx.invoice.update({
      where: { id: existing.id },
      data: {
        invoiceDate: data.invoiceDate,
        taxScheme: data.taxScheme,
        taxRatePct: data.taxRatePct,
        taxableBasis: data.taxableBasis,
        placeOfSupplyState: data.placeOfSupplyState,
        placeOfSupplyStateCode: data.placeOfSupplyStateCode,
        supplierSnapshot: data.supplierSnapshot,
        recipientSnapshot: data.recipientSnapshot,
        subtotal: data.subtotal,
        cgstAmount: data.cgstAmount,
        sgstAmount: data.sgstAmount,
        igstAmount: data.igstAmount,
        taxTotal: data.taxTotal,
        roundOff: data.roundOff,
        grandTotal: data.grandTotal,
        amountInWords: data.amountInWords,
        items: data.items,
      },
    });
  });
}

export type UpdateDraftInvoiceInput = {
  invoiceId: string;
  scheme?: InvoiceTaxScheme;
  basis?: TaxableBasis;
  placeOfSupplyState?: string | null;
  placeOfSupplyStateCode?: string | null;
  invoiceDate?: Date;
  /** Provide to replace all line items. Omit to keep existing items but recompute taxes. */
  lines?: DraftInvoiceLine[];
};

/**
 * Edit a DRAFT invoice. Recomputes taxes via the dedicated tax service and
 * refreshes denormalized totals. Throws if invoice is not DRAFT — once
 * ISSUED the document is immutable per GST law.
 */
export async function updateDraftInvoice(
  input: UpdateDraftInvoiceInput
): Promise<Invoice> {
  const existing = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "DRAFT") {
    throw new Error(
      `Invoice is ${existing.status} and cannot be edited. Cancel it and create a new draft.`
    );
  }

  const settings = await prisma.agencySettings.findUnique({
    where: { agencyId: existing.agencyId },
  });
  if (!settings) throw new Error("Agency settings missing");

  const scheme = input.scheme ?? existing.taxScheme;
  const basis = input.basis ?? existing.taxableBasis;
  const placeOfSupplyState =
    input.placeOfSupplyState !== undefined
      ? input.placeOfSupplyState
      : existing.placeOfSupplyState;
  const placeOfSupplyStateCode =
    input.placeOfSupplyStateCode !== undefined
      ? input.placeOfSupplyStateCode
      : existing.placeOfSupplyStateCode;

  // Reuse provided lines, otherwise mirror existing items (preserves manual edits)
  const baseLines: DraftInvoiceLine[] =
    input.lines && input.lines.length > 0
      ? input.lines
      : existing.items.map((it) => ({
          description: it.description,
          sacCode: it.sacCode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          cost: it.cost,
          position: it.position,
        }));

  const taxInput: TaxComputationLineInput[] = baseLines.map((l) => ({
    description: l.description,
    sacCode: l.sacCode ?? settings.defaultSacCode,
    quantity: l.quantity ?? 1,
    unitPrice: l.unitPrice,
    cost: l.cost ?? null,
  }));
  const computed = computeInvoiceTaxes({
    scheme,
    basis,
    supplierStateCode: settings.stateCode,
    placeOfSupplyStateCode,
    lines: taxInput,
  });

  return prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
    return tx.invoice.update({
      where: { id: existing.id },
      data: {
        invoiceDate: input.invoiceDate ?? existing.invoiceDate,
        taxScheme: scheme,
        taxRatePct: computed.taxRatePct,
        taxableBasis: basis,
        placeOfSupplyState,
        placeOfSupplyStateCode,
        subtotal: computed.subtotal,
        cgstAmount: computed.cgstAmount,
        sgstAmount: computed.sgstAmount,
        igstAmount: computed.igstAmount,
        taxTotal: computed.taxTotal,
        roundOff: computed.roundOff,
        grandTotal: computed.grandTotal,
        amountInWords: amountInWordsINR(computed.grandTotal),
        items: {
          create: computed.lines.map((l, i) => ({
            position: baseLines[i]?.position ?? i,
            description: l.description,
            sacCode: l.sacCode,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            cost: l.cost ?? null,
            taxableValue: l.taxableValue,
            taxRatePct: l.taxRatePct,
            cgstAmount: l.cgstAmount,
            sgstAmount: l.sgstAmount,
            igstAmount: l.igstAmount,
          })),
        },
      },
    });
  });
}

/**
 * Locks an invoice with the next sequential number for its FY. Becomes
 * immutable thereafter — `updateDraftInvoice` will throw on ISSUED docs.
 */
export async function issueInvoice(invoiceId: string): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status !== "DRAFT") {
      throw new Error(`Invoice is ${invoice.status} — only DRAFT can be issued`);
    }

    const settings = await tx.agencySettings.findUnique({
      where: { agencyId: invoice.agencyId },
      select: { invoicePrefix: true },
    });
    if (!settings) {
      throw new Error("Agency settings missing — cannot allocate a number");
    }

    const issueDate = new Date();
    const allocated = await allocateNextInvoiceNumber(tx, {
      agencyId: invoice.agencyId,
      prefix: settings.invoicePrefix,
      issueDate,
    });

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "ISSUED",
        issuedAt: issueDate,
        invoiceNumber: allocated.invoiceNumber,
        invoiceFy: allocated.fiscalYear,
        invoiceSequence: allocated.sequence,
      },
    });
  });
}

export async function cancelInvoice(
  invoiceId: string,
  reason: string
): Promise<Invoice> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "CANCELLED") return invoice;
  if (invoice.status === "DRAFT") {
    // Drafts have no number — just hard-delete to keep the table tidy
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason.trim(),
      },
    });
  }
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason.trim(),
    },
  });
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      booking: {
        include: {
          trip: {
            select: {
              id: true,
              destination: true,
              days: true,
              startDate: true,
              contact: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
  });
}
