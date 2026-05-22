// High-level orchestration. Server actions and the automation runner call
// these functions instead of touching lib/whatsapp/send directly — they
// add domain context (which contact, which agency, which template) and write
// the matching Activity rows.
//
// Everything here is single-tenant for now (operates on the demo user),
// but takes `agencyId` so future multi-tenancy is a config flip, not a
// rewrite.

import type {
  ActivityType,
  WhatsappAutomationTrigger,
  WhatsappTemplate,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildIdempotencyKey,
  findSeedTemplate,
  interpolateTemplate,
  sendDocumentMessage,
  sendTemplateMessage,
  sendTextMessage,
  type DispatchResult,
  type TemplateVariables,
} from "@/lib/whatsapp";
import type { TemplateVariableDef } from "@/lib/whatsapp/templates";

export type EntityLink = {
  contactId?: string | null;
  customerId?: string | null;
  tripId?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
};

async function logComms(args: {
  link: EntityLink;
  type: ActivityType;
  title: string;
  body?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { link } = args;
  if (!link.contactId && !link.tripId && !link.invoiceId) return;
  await prisma.activity.create({
    data: {
      contactId: link.contactId ?? null,
      tripId: link.tripId ?? null,
      invoiceId: link.invoiceId ?? null,
      type: args.type,
      title: args.title,
      body: args.body ?? null,
      metadata: args.metadata,
    },
  });
}

function firstName(full: string | null | undefined): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function publicBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

async function getAgencyName(agencyId: string): Promise<string> {
  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: { tradeName: true, legalName: true },
  });
  return s?.tradeName || s?.legalName || "TripCraft";
}

type ResolvedTemplate = {
  source: "registered" | "seed" | "text";
  templateName: string;
  language: string;
  variables: TemplateVariableDef[];
  body: string;
  templateRowId?: string;
};

/**
 * Try to find a registered template for the agency. If none exists, fall
 * back to a built-in seed template (still uses the seed's body for the
 * text rendering — but marks it as not-registered so the send falls back
 * to plain text). This means proposal/invoice/reminder flows work *now*
 * without operators having to register Meta templates first.
 */
async function resolveTemplate(
  agencyId: string,
  templateMetaName: string
): Promise<ResolvedTemplate> {
  const seed = findSeedTemplate(templateMetaName);
  const registered = await prisma.whatsappTemplate.findFirst({
    where: { agencyId, templateId: templateMetaName, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (registered) {
    return {
      source: "registered",
      templateName: registered.templateId,
      language: registered.language,
      variables: parseTemplateVars(registered),
      body: registered.bodyPreview,
      templateRowId: registered.id,
    };
  }
  if (seed) {
    return {
      source: "seed",
      templateName: seed.templateId,
      language: seed.language,
      variables: seed.variables,
      body: seed.body,
    };
  }
  // No template — caller will use the literal body via sendTextMessage.
  return {
    source: "text",
    templateName: templateMetaName,
    language: "en",
    variables: [],
    body: "",
  };
}

function parseTemplateVars(t: WhatsappTemplate): TemplateVariableDef[] {
  if (!t.variables) return [];
  if (Array.isArray(t.variables)) return t.variables as unknown as TemplateVariableDef[];
  return [];
}

/**
 * Send a message using a template if registered, otherwise as a plain text
 * with the seed body interpolated. The unified return shape lets callers
 * treat both paths the same way.
 */
async function sendTemplatedOrText(args: {
  agencyId: string;
  sentByUserId?: string | null;
  toPhone: string;
  templateMetaName: string;
  values: TemplateVariables;
  link: EntityLink;
  automationRuleId?: string | null;
  idempotencyKey?: string | null;
}): Promise<{ result: DispatchResult; resolved: ResolvedTemplate; rendered: string }> {
  const resolved = await resolveTemplate(args.agencyId, args.templateMetaName);

  if (resolved.source === "registered" || resolved.source === "seed") {
    const rendered = interpolateTemplate(resolved.body, args.values);

    if (resolved.source === "registered") {
      const result = await sendTemplateMessage({
        agencyId: args.agencyId,
        sentByUserId: args.sentByUserId ?? null,
        toPhone: args.toPhone,
        templateName: resolved.templateName,
        templateId: resolved.templateName,
        language: resolved.language,
        variables: resolved.variables,
        values: args.values,
        message: resolved.body,
        link: args.link,
        automationRuleId: args.automationRuleId ?? undefined,
        idempotencyKey: args.idempotencyKey ?? undefined,
        metadata: {
          language: resolved.language,
          variables: resolved.variables,
          values: args.values,
          templateRowId: resolved.templateRowId,
        },
      });
      return { result, resolved, rendered };
    }
    // seed → plain text with rendered body
    const result = await sendTextMessage({
      agencyId: args.agencyId,
      sentByUserId: args.sentByUserId ?? null,
      toPhone: args.toPhone,
      message: rendered,
      templateName: resolved.templateName,
      templateId: resolved.templateName,
      link: args.link,
      automationRuleId: args.automationRuleId ?? undefined,
      idempotencyKey: args.idempotencyKey ?? undefined,
      kind: "TEXT",
      metadata: {
        seed: true,
        values: args.values,
        sourceTemplate: resolved.templateName,
      },
    });
    return { result, resolved, rendered };
  }

  // No template at all — caller must supply a literal message.
  const result = await sendTextMessage({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: args.toPhone,
    message: "",
    link: args.link,
    automationRuleId: args.automationRuleId ?? undefined,
    idempotencyKey: args.idempotencyKey ?? undefined,
    kind: "TEXT",
  });
  return { result, resolved, rendered: "" };
}

// === Public orchestration entry points ===

export async function sendManualText(args: {
  agencyId: string;
  sentByUserId?: string | null;
  toPhone: string;
  message: string;
  link: EntityLink;
  asNote?: boolean;
}): Promise<DispatchResult> {
  const result = await sendTextMessage({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: args.toPhone,
    message: args.message,
    link: args.link,
    kind: "TEXT",
    metadata: { manual: true },
  });
  await logComms({
    link: args.link,
    type: "WHATSAPP_OUTBOUND",
    title: "WhatsApp message sent",
    body: args.message.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, phone: args.toPhone },
  });
  return result;
}

export async function shareProposalOnWhatsapp(args: {
  agencyId: string;
  sentByUserId?: string | null;
  tripId: string;
  quoteId: string;
}): Promise<DispatchResult & { previewUrl: string }> {
  const quote = await prisma.quote.findUnique({
    where: { id: args.quoteId },
    include: {
      trip: {
        include: {
          contact: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!quote) throw new Error("Quote not found");
  if (!quote.trip.contact) throw new Error("Trip has no contact — can't resolve recipient");
  if (!quote.trip.contact.phone) throw new Error("Contact has no phone — add one first");

  // Make sure we have a public share token
  let shareToken = quote.shareToken;
  if (!shareToken) {
    const { randomBytes } = await import("crypto");
    shareToken = randomBytes(18).toString("base64url");
    await prisma.quote.update({ where: { id: quote.id }, data: { shareToken } });
  }
  const previewUrl = `${publicBase()}/share/${shareToken}`;
  const agency = await getAgencyName(args.agencyId);

  const idem = buildIdempotencyKey([
    args.agencyId,
    "proposal",
    quote.id,
    quote.trip.contact.phone,
    new Date().toISOString().slice(0, 10),
  ]);

  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: quote.trip.contact.phone,
    templateMetaName: "tc_proposal_share",
    values: {
      name: firstName(quote.trip.contact.name),
      destination: quote.trip.destination,
      proposal_link: previewUrl,
      agency,
    },
    link: {
      contactId: quote.trip.contact.id,
      tripId: quote.trip.id,
      bookingId: null,
    },
    idempotencyKey: idem,
  });

  await logComms({
    link: { contactId: quote.trip.contact.id, tripId: quote.trip.id },
    type: "QUOTE_SENT_WHATSAPP",
    title: `Quote v${quote.version} shared on WhatsApp`,
    body: rendered.slice(0, 500),
    metadata: {
      whatsappMessageId: result.messageId,
      quoteId: quote.id,
      previewUrl,
    },
  });

  return { ...result, previewUrl };
}

export async function shareInvoiceOnWhatsapp(args: {
  agencyId: string;
  sentByUserId?: string | null;
  invoiceId: string;
  documentUrl?: string | null;
}): Promise<DispatchResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: args.invoiceId },
    include: {
      booking: {
        include: {
          trip: { include: { contact: { select: { id: true, name: true, phone: true } } } },
        },
      },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  const contact = invoice.booking.trip.contact;
  if (!contact) throw new Error("Invoice booking has no contact — can't resolve recipient");
  if (!contact.phone) throw new Error("Contact has no phone — add one first");

  if (!invoice.shareToken) {
    const { randomBytes } = await import("crypto");
    const token = randomBytes(18).toString("base64url");
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { shareToken: token },
    });
    invoice.shareToken = token;
  }

  // The customer-facing "view online" link points at the PDF route directly
  // for now (no dedicated /i/<token> page exists yet — the PDF is the artifact).
  const link = `${publicBase()}/api/invoices/${invoice.id}/pdf?token=${invoice.shareToken}`;
  // Default to the same URL as the document attachment when the caller
  // didn't supply one — the WhatsApp message then sends the PDF inline
  // rather than just a link.
  const resolvedDocumentUrl =
    args.documentUrl ??
    `${publicBase()}/api/invoices/${invoice.id}/pdf?token=${invoice.shareToken}`;
  const agency = await getAgencyName(args.agencyId);
  const balanceDue = invoice.grandTotal - 0; // could be reduced by paid amount in caller
  const amount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(invoice.grandTotal);

  const idem = buildIdempotencyKey([
    args.agencyId,
    "invoice",
    invoice.id,
    contact.phone,
    new Date().toISOString().slice(0, 10),
  ]);

  const linkCtx: EntityLink = {
    contactId: contact.id,
    tripId: invoice.booking.trip.id,
    invoiceId: invoice.id,
    bookingId: invoice.bookingId,
  };

  // Send the message first (template or text-with-link)
  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: contact.phone,
    templateMetaName: "tc_invoice_share",
    values: {
      name: firstName(contact.name),
      invoice_number: invoice.invoiceNumber ?? `DRAFT-${invoice.id.slice(-6)}`,
      amount,
      due_status: balanceDue > 0 ? `Outstanding balance.` : "Fully paid — receipt attached.",
      agency,
    },
    link: linkCtx,
    idempotencyKey: idem,
  });

  // Always attach the PDF — either the caller's URL or the auto-generated
  // /api/invoices/[id]/pdf endpoint. We do NOT promise "attached" in the
  // template body if this send fails; check the activity log for the
  // attachment row's status.
  if (resolvedDocumentUrl) {
    await sendDocumentMessage({
      agencyId: args.agencyId,
      sentByUserId: args.sentByUserId ?? null,
      toPhone: contact.phone,
      documentUrl: resolvedDocumentUrl,
      filename: `${invoice.invoiceNumber ?? invoice.id}.pdf`,
      caption: `Invoice ${invoice.invoiceNumber ?? ""}`,
      message: `Invoice ${invoice.invoiceNumber ?? ""}`,
      link: linkCtx,
      idempotencyKey: buildIdempotencyKey([
        args.agencyId,
        "invoice-pdf",
        invoice.id,
        contact.phone,
        new Date().toISOString().slice(0, 10),
      ]),
      metadata: { invoiceId: invoice.id },
    });
  }

  await logComms({
    link: linkCtx,
    type: "INVOICE_SENT_WHATSAPP",
    title: `Invoice ${invoice.invoiceNumber ?? "(draft)"} sent on WhatsApp`,
    body: rendered.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, invoiceId: invoice.id, link },
  });

  return result;
}

export async function sendPaymentReminder(args: {
  agencyId: string;
  sentByUserId?: string | null;
  invoiceId: string;
  stage: "T_MINUS_3" | "DUE_TODAY" | "OVERDUE_2D";
  automationRuleId?: string | null;
}): Promise<DispatchResult> {
  const templateMap = {
    T_MINUS_3: "tc_payment_reminder_t3",
    DUE_TODAY: "tc_payment_reminder_due",
    OVERDUE_2D: "tc_payment_reminder_overdue",
  } as const;

  const invoice = await prisma.invoice.findUnique({
    where: { id: args.invoiceId },
    include: {
      booking: {
        include: {
          payments: true,
          trip: { include: { contact: true } },
        },
      },
    },
  });
  if (!invoice) throw new Error("Invoice not found");
  const contact = invoice.booking.trip.contact;
  if (!contact?.phone) throw new Error("Contact has no phone for reminder");

  const paid = invoice.booking.payments.reduce((s, p) => s + p.amount, 0);
  const balance = invoice.grandTotal - paid;
  if (balance <= 0) {
    return { messageId: "", status: "FAILED", error: "Invoice already paid — skipping reminder" };
  }

  const agency = await getAgencyName(args.agencyId);
  const amountStr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(balance);
  const dueDate = invoice.invoiceDate
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(invoice.invoiceDate)
    : "soon";
  const invoiceLink = invoice.shareToken
    ? `${publicBase()}/i/${invoice.shareToken}`
    : `${publicBase()}/invoices/${invoice.id}`;

  const idem = buildIdempotencyKey([
    args.agencyId,
    "payment-reminder",
    invoice.id,
    args.stage,
    new Date().toISOString().slice(0, 10),
  ]);

  const linkCtx: EntityLink = {
    contactId: contact.id,
    tripId: invoice.booking.trip.id,
    invoiceId: invoice.id,
    bookingId: invoice.bookingId,
  };

  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: contact.phone,
    templateMetaName: templateMap[args.stage],
    values: {
      name: firstName(contact.name),
      amount: amountStr,
      due_date: dueDate,
      invoice_link: invoiceLink,
      agency,
    },
    link: linkCtx,
    automationRuleId: args.automationRuleId ?? null,
    idempotencyKey: idem,
  });

  await logComms({
    link: linkCtx,
    type: "PAYMENT_REMINDER_SENT",
    title: `Payment reminder sent (${args.stage.replace(/_/g, " ").toLowerCase()})`,
    body: rendered.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, stage: args.stage, balance },
  });
  return result;
}

export async function sendFollowUp(args: {
  agencyId: string;
  sentByUserId?: string | null;
  contactId: string;
  stage: "T_24H" | "T_3D" | "T_7D";
  automationRuleId?: string | null;
}): Promise<DispatchResult> {
  const templateMap = {
    T_24H: "tc_followup_24h",
    T_3D: "tc_followup_3d",
    T_7D: "tc_followup_7d",
  } as const;

  const contact = await prisma.contact.findUnique({
    where: { id: args.contactId },
    include: { trips: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!contact) throw new Error("Contact not found");
  if (!contact.phone) throw new Error("Contact has no phone");

  const agency = await getAgencyName(args.agencyId);
  const idem = buildIdempotencyKey([
    args.agencyId,
    "followup",
    contact.id,
    args.stage,
    new Date().toISOString().slice(0, 10),
  ]);

  const linkCtx: EntityLink = {
    contactId: contact.id,
    tripId: contact.trips[0]?.id ?? null,
  };

  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: contact.phone,
    templateMetaName: templateMap[args.stage],
    values: {
      name: firstName(contact.name),
      destination: contact.destination ?? "your next trip",
      agency,
    },
    link: linkCtx,
    automationRuleId: args.automationRuleId ?? null,
    idempotencyKey: idem,
  });

  await logComms({
    link: linkCtx,
    type: "FOLLOW_UP_SENT",
    title: `Follow-up sent (${args.stage})`,
    body: rendered.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, stage: args.stage },
  });
  return result;
}

export async function sendTripReminder(args: {
  agencyId: string;
  sentByUserId?: string | null;
  tripId: string;
  stage: "T_MINUS_7" | "T_MINUS_1" | "DEPARTURE" | "THANKS";
  automationRuleId?: string | null;
  voucherLink?: string | null;
}): Promise<DispatchResult> {
  const templateMap = {
    T_MINUS_7: "tc_trip_t_minus_7",
    T_MINUS_1: "tc_trip_t_minus_1",
    DEPARTURE: "tc_trip_departure_day",
    THANKS: "tc_trip_thanks",
  } as const;

  const trip = await prisma.trip.findUnique({
    where: { id: args.tripId },
    include: { contact: true },
  });
  if (!trip) throw new Error("Trip not found");
  const contact = trip.contact;
  if (!contact?.phone) throw new Error("Trip contact has no phone");

  const agency = await getAgencyName(args.agencyId);
  const startDate = trip.startDate
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(trip.startDate)
    : "soon";

  const idem = buildIdempotencyKey([
    args.agencyId,
    "trip-reminder",
    trip.id,
    args.stage,
    new Date().toISOString().slice(0, 10),
  ]);

  const linkCtx: EntityLink = {
    contactId: contact.id,
    tripId: trip.id,
  };

  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: contact.phone,
    templateMetaName: templateMap[args.stage],
    values: {
      name: firstName(contact.name),
      destination: trip.destination,
      start_date: startDate,
      voucher_link: args.voucherLink ?? `${publicBase()}/trips/${trip.id}`,
      ops_phone: process.env.WHATSAPP_OPS_PHONE ?? "+91 90000 00000",
      review_link: process.env.WHATSAPP_REVIEW_LINK ?? `${publicBase()}/trips/${trip.id}`,
      agency,
    },
    link: linkCtx,
    automationRuleId: args.automationRuleId ?? null,
    idempotencyKey: idem,
  });

  await logComms({
    link: linkCtx,
    type: "TRIP_REMINDER_SENT",
    title: `Trip reminder sent (${args.stage})`,
    body: rendered.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, stage: args.stage },
  });

  return result;
}

export async function sendVoucherOnWhatsapp(args: {
  agencyId: string;
  sentByUserId?: string | null;
  voucherId: string;
}): Promise<DispatchResult> {
  const voucher = await prisma.voucher.findUnique({
    where: { id: args.voucherId },
    include: {
      assignment: {
        include: {
          vendor: { select: { whatsapp: true, phone: true, name: true } },
          trip: { include: { contact: true } },
        },
      },
    },
  });
  if (!voucher) throw new Error("Voucher not found");
  const trip = voucher.assignment.trip;
  const contact = trip.contact;
  if (!contact?.phone) throw new Error("Trip contact has no phone");

  const agency = await getAgencyName(args.agencyId);
  const link = `${publicBase()}/v/${voucher.shareToken}`;
  const idem = buildIdempotencyKey([
    args.agencyId,
    "voucher",
    voucher.id,
    contact.phone,
    new Date().toISOString().slice(0, 10),
  ]);
  const linkCtx: EntityLink = { contactId: contact.id, tripId: trip.id };

  const { result, rendered } = await sendTemplatedOrText({
    agencyId: args.agencyId,
    sentByUserId: args.sentByUserId ?? null,
    toPhone: contact.phone,
    templateMetaName: "tc_ops_voucher",
    values: {
      name: firstName(contact.name),
      voucher_title: voucher.title,
      voucher_link: link,
      agency,
    },
    link: linkCtx,
    idempotencyKey: idem,
  });

  await logComms({
    link: linkCtx,
    type: "VOUCHER_SENT_WHATSAPP",
    title: `Voucher ${voucher.voucherNumber} sent on WhatsApp`,
    body: rendered.slice(0, 500),
    metadata: { whatsappMessageId: result.messageId, voucherId: voucher.id },
  });

  // Stamp the voucher's sentAt — the existing Operations dashboard reads this.
  if (!voucher.sentAt) {
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { sentAt: new Date() },
    });
  }

  return result;
}

// === Template + automation rule management ===

/**
 * Aggregate WhatsApp activity for a batch of CRM entities. Used by list
 * pages (bookings, customers, leads kanban) to render per-row badges without
 * triggering N+1 queries — one DB round trip, bucket in memory.
 */
export async function getWhatsappStatsForEntities(args: {
  agencyId: string;
  scope: "contactId" | "tripId" | "customerId" | "invoiceId" | "bookingId";
  ids: string[];
}): Promise<
  Map<
    string,
    {
      count: number;
      lastDirection: "INBOUND" | "OUTBOUND";
      lastStatus: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
      lastAt: Date;
      unreadInbound: number; // inbound messages after last outbound
    }
  >
> {
  const result = new Map<
    string,
    {
      count: number;
      lastDirection: "INBOUND" | "OUTBOUND";
      lastStatus: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
      lastAt: Date;
      unreadInbound: number;
    }
  >();
  if (args.ids.length === 0) return result;

  const rows = await prisma.whatsappMessage.findMany({
    where: { agencyId: args.agencyId, [args.scope]: { in: args.ids } },
    select: {
      [args.scope]: true,
      direction: true,
      status: true,
      createdAt: true,
    } as Record<string, true>,
    orderBy: { createdAt: "asc" },
  });

  for (const r of rows as Array<{
    direction: "INBOUND" | "OUTBOUND";
    status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
    createdAt: Date;
    [k: string]: unknown;
  }>) {
    const key = r[args.scope] as string | null;
    if (!key) continue;
    const cur = result.get(key);
    if (!cur) {
      result.set(key, {
        count: 1,
        lastDirection: r.direction,
        lastStatus: r.status,
        lastAt: r.createdAt,
        unreadInbound: r.direction === "INBOUND" ? 1 : 0,
      });
    } else {
      cur.count += 1;
      cur.lastDirection = r.direction;
      cur.lastStatus = r.status;
      cur.lastAt = r.createdAt;
      // Reset the unread counter every time an outbound goes out (means we
      // replied / acknowledged); accumulate while inbound only.
      if (r.direction === "OUTBOUND") {
        cur.unreadInbound = 0;
      } else {
        cur.unreadInbound += 1;
      }
    }
  }

  return result;
}

export async function listTemplates(agencyId: string) {
  return prisma.whatsappTemplate.findMany({
    where: { agencyId },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });
}

export async function upsertTemplate(args: {
  agencyId: string;
  createdById?: string | null;
  id?: string | null;
  name: string;
  templateId: string;
  category: WhatsappTemplate["category"];
  language: string;
  bodyPreview: string;
  variables: TemplateVariableDef[];
  isActive?: boolean;
}) {
  if (args.id) {
    return prisma.whatsappTemplate.update({
      where: { id: args.id },
      data: {
        name: args.name,
        templateId: args.templateId,
        category: args.category,
        language: args.language,
        bodyPreview: args.bodyPreview,
        variables: args.variables as unknown as Prisma.InputJsonValue,
        isActive: args.isActive ?? true,
      },
    });
  }
  return prisma.whatsappTemplate.upsert({
    where: {
      agencyId_templateId_language: {
        agencyId: args.agencyId,
        templateId: args.templateId,
        language: args.language,
      },
    },
    update: {
      name: args.name,
      category: args.category,
      bodyPreview: args.bodyPreview,
      variables: args.variables as unknown as Prisma.InputJsonValue,
      isActive: args.isActive ?? true,
    },
    create: {
      agencyId: args.agencyId,
      createdById: args.createdById ?? null,
      name: args.name,
      templateId: args.templateId,
      category: args.category,
      language: args.language,
      bodyPreview: args.bodyPreview,
      variables: args.variables as unknown as Prisma.InputJsonValue,
      isActive: args.isActive ?? true,
    },
  });
}

export async function listAutomationRules(agencyId: string) {
  return prisma.whatsappAutomationRule.findMany({
    where: { agencyId },
    include: { template: true },
    orderBy: { trigger: "asc" },
  });
}

export async function upsertAutomationRule(args: {
  agencyId: string;
  trigger: WhatsappAutomationTrigger;
  templateRowId: string;
  enabled: boolean;
  delayMinutes?: number;
}) {
  return prisma.whatsappAutomationRule.upsert({
    where: { agencyId_trigger: { agencyId: args.agencyId, trigger: args.trigger } },
    create: {
      agencyId: args.agencyId,
      trigger: args.trigger,
      templateId: args.templateRowId,
      enabled: args.enabled,
      delayMinutes: args.delayMinutes ?? 0,
    },
    update: {
      templateId: args.templateRowId,
      enabled: args.enabled,
      delayMinutes: args.delayMinutes ?? 0,
    },
  });
}

export async function setAutomationRuleEnabled(
  agencyId: string,
  ruleId: string,
  enabled: boolean
) {
  return prisma.whatsappAutomationRule.update({
    where: { id: ruleId },
    data: { enabled },
  });
}
