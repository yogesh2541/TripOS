"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import { computePricing, type PricingItem } from "@/types";
import { logActivity } from "@/server/helpers/log-activity";
import { recomputeContactStatus } from "@/server/helpers/contact-status";
import { seedVendorAssignmentsFromQuote } from "@/server/helpers/seed-vendor-assignments";

const itemSchema = z.object({
  id: z.string(),
  category: z.enum(["Hotel", "Transport", "Activities", "Flights", "Other"]),
  label: z.string().max(200),
  cost: z.coerce.number().min(0),
});

const saveSchema = z.object({
  tripId: z.string(),
  quoteId: z.string().nullable(),
  items: z.array(itemSchema),
  markupPct: z.coerce.number().min(0).max(500),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  // Operator-only notes — never reaches the customer.
  internalNotes: z.string().max(2000).optional().nullable(),
});

export type SaveQuoteInput = z.infer<typeof saveSchema>;

export async function saveQuoteAction(input: SaveQuoteInput) {
  const data = saveSchema.parse(input);
  const { agencyId } = await requireAgency();
  await assertCan(data.quoteId ? "quote:update" : "quote:create");

  // Tenancy fence: the trip must belong to the caller's agency.
  const ownTrip = await prisma.trip.findFirst({
    where: { id: data.tripId, agencyId },
    select: { id: true },
  });
  if (!ownTrip) throw new Error("Trip not found");

  const summary = computePricing({
    items: data.items as PricingItem[],
    markupPct: data.markupPct,
    discountPct: data.discountPct,
  });

  let quoteId = data.quoteId;

  if (quoteId) {
    // Scope to the trip we just authorized — a quote id from another trip
    // (or agency) won't resolve.
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tripId: data.tripId },
    });
    if (!quote) throw new Error("Quote not found");
    if (quote.status !== "DRAFT") {
      throw new Error("Only draft quotes can be edited");
    }
  } else {
    // First quote on this trip — create v1.
    const latest = await prisma.quote.findFirst({
      where: { tripId: data.tripId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const created = await prisma.quote.create({
      data: {
        tripId: data.tripId,
        version: nextVersion,
        status: "DRAFT",
        markupPct: data.markupPct,
        discountPct: data.discountPct,
        totalCost: summary.totalCost,
        sellingPrice: summary.sellingPrice,
        profit: summary.profit,
        internalNotes: data.internalNotes?.trim() || null,
      },
    });
    quoteId = created.id;
  }

  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId } }),
    prisma.quoteItem.createMany({
      data: data.items.map((it, idx) => ({
        quoteId: quoteId!,
        category: it.category,
        label: it.label,
        cost: it.cost,
        position: idx,
      })),
    }),
    prisma.quote.update({
      where: { id: quoteId },
      data: {
        markupPct: data.markupPct,
        discountPct: data.discountPct,
        totalCost: summary.totalCost,
        sellingPrice: summary.sellingPrice,
        profit: summary.profit,
        internalNotes: data.internalNotes?.trim() || null,
      },
    }),
  ]);

  revalidatePath(`/trips/${data.tripId}`);
  revalidatePath(`/trips/${data.tripId}/preview`);
  return { quoteId, summary };
}

export async function duplicateQuoteAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:create");
  const source = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!source) throw new Error("Quote not found");

  const latest = await prisma.quote.findFirst({
    where: { tripId: source.tripId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const next = await prisma.quote.create({
    data: {
      tripId: source.tripId,
      version: nextVersion,
      status: "DRAFT",
      markupPct: source.markupPct,
      discountPct: source.discountPct,
      totalCost: source.totalCost,
      sellingPrice: source.sellingPrice,
      profit: source.profit,
      items: {
        create: source.items.map((it, idx) => ({
          category: it.category,
          label: it.label,
          cost: it.cost,
          position: idx,
        })),
      },
    },
  });

  revalidatePath(`/trips/${source.tripId}`);
  return { quoteId: next.id, version: nextVersion };
}

export async function deleteQuoteAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:update");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "ACCEPTED") {
    throw new Error("Can't delete an accepted quote — cancel its booking first");
  }
  await prisma.quote.delete({ where: { id: quoteId } });
  revalidatePath(`/trips/${quote.tripId}`);
  return { ok: true as const };
}

export async function markQuoteSentAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:update");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: { trip: { select: { id: true, contactId: true, status: true } } },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") {
    throw new Error(`Quote is ${quote.status}, only drafts can be marked sent`);
  }

  await prisma.$transaction([
    prisma.quote.update({
      where: { id: quoteId },
      data: { status: "SENT" },
    }),
    prisma.trip.update({
      where: { id: quote.tripId },
      data: {
        status: quote.trip.status === "PLANNING" ? "QUOTED" : quote.trip.status,
      },
    }),
  ]);

  if (quote.trip.contactId) {
    // Forward-only — won't drag a contact back if they're already WON
    // on another trip.
    await recomputeContactStatus(quote.trip.contactId);
    await logActivity({
      contactId: quote.trip.contactId,
      type: "QUOTE_SENT",
      title: `Quote v${quote.version} marked sent`,
      metadata: { quoteId, tripId: quote.tripId, version: quote.version },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  if (quote.trip.contactId) revalidatePath(`/contacts/${quote.trip.contactId}`);
  return { ok: true as const };
}

export async function rejectQuoteAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:update");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: { trip: { select: { id: true, contactId: true } } },
  });
  if (!quote) throw new Error("Quote not found");

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "REJECTED" },
  });

  if (quote.trip.contactId) {
    await logActivity({
      contactId: quote.trip.contactId,
      type: "STATUS_CHANGED",
      title: `Quote v${quote.version} rejected`,
      metadata: { quoteId, version: quote.version },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  return { ok: true as const };
}

export async function acceptQuoteAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:accept");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: { trip: { select: { id: true, contactId: true } } },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "ACCEPTED") {
    return { ok: true as const, alreadyAccepted: true };
  }

  const existingBooking = await prisma.booking.findFirst({
    where: { tripId: quote.tripId, status: { not: "CANCELLED" } },
  });
  if (existingBooking) {
    throw new Error(
      "This trip already has an active booking. Cancel it before accepting another quote."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACCEPTED" },
    });
    const booking = await tx.booking.create({
      data: {
        tripId: quote.tripId,
        quoteId,
        status: "PENDING",
        totalAmount: quote.sellingPrice,
      },
    });
    await tx.trip.update({
      where: { id: quote.tripId },
      data: { status: "BOOKED" },
    });
    // Turn the quoted line items into draft vendor assignments.
    await seedVendorAssignmentsFromQuote(tx, {
      tripId: quote.tripId,
      quoteId,
      bookingId: booking.id,
    });
  });

  if (quote.trip.contactId) {
    await recomputeContactStatus(quote.trip.contactId);
    await logActivity({
      contactId: quote.trip.contactId,
      type: "QUOTE_ACCEPTED",
      title: `Quote v${quote.version} accepted`,
      metadata: { quoteId, version: quote.version },
    });
    await logActivity({
      contactId: quote.trip.contactId,
      type: "BOOKING_CREATED",
      title: "Booking created",
      metadata: { quoteId, tripId: quote.tripId },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  if (quote.trip.contactId) revalidatePath(`/contacts/${quote.trip.contactId}`);
  return { ok: true as const };
}

export async function revertQuoteToDraftAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:update");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: {
      trip: { select: { id: true, contactId: true } },
      booking: {
        include: {
          payments: { take: 1 },
          invoice: { select: { id: true, status: true, invoiceNumber: true } },
        },
      },
    },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "DRAFT") return { ok: true as const };

  const previousStatus = quote.status;

  // Reverting an ACCEPTED quote tears down the auto-created booking
  // and walks the trip/contact status back. Block if any payments exist —
  // the agent should clear those first so we don't silently lose money trail.
  if (quote.status === "ACCEPTED") {
    if (quote.booking && quote.booking.payments.length > 0) {
      throw new Error(
        "Can't revert — this booking has recorded payments. Delete the payments first."
      );
    }
    // Only a LIVE (issued) tax invoice blocks the revert — it's a legal
    // document with a number that mustn't vanish silently. A draft or an
    // already-cancelled invoice is safe to remove, which we must do anyway:
    // the booking's FK is onDelete: Restrict, so the invoice has to go before
    // the booking can be deleted. (InvoiceItems cascade from the invoice;
    // activities referencing it cascade / null out.)
    const invoice = quote.booking?.invoice ?? null;
    if (invoice && invoice.status === "ISSUED") {
      throw new Error(
        `Can't revert — tax invoice ${
          invoice.invoiceNumber ?? ""
        }`.trim() +
          " is issued for this booking. Cancel the invoice first, then revert."
      );
    }
    await prisma.$transaction(async (tx) => {
      if (quote.booking) {
        // Draft or cancelled invoice → delete it first so the booking FK
        // (Invoice_bookingId_fkey, Restrict) no longer blocks the delete.
        if (invoice) {
          await tx.invoice.delete({ where: { id: invoice.id } });
        }
        await tx.booking.delete({ where: { id: quote.booking.id } });
      }
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: "DRAFT" },
      });
      // Trip drops back to QUOTED only if no other accepted quote exists.
      const stillAccepted = await tx.quote.findFirst({
        where: {
          tripId: quote.tripId,
          status: "ACCEPTED",
          id: { not: quoteId },
        },
      });
      if (!stillAccepted) {
        await tx.trip.update({
          where: { id: quote.tripId },
          data: { status: "QUOTED" },
        });
      }
    });

    if (quote.trip.contactId) {
      // Walk Contact status back to QUOTED only if it's currently WON.
      // Don't touch LOST or earlier states.
      const contact = await prisma.contact.findUnique({
        where: { id: quote.trip.contactId },
        select: { status: true },
      });
      if (contact?.status === "WON") {
        await prisma.contact.update({
          where: { id: quote.trip.contactId },
          data: { status: "QUOTED" },
        });
      }
    }
  } else {
    // SENT or REJECTED → DRAFT is a simple status change.
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: "DRAFT" },
    });
  }

  if (quote.trip.contactId) {
    await logActivity({
      contactId: quote.trip.contactId,
      type: "STATUS_CHANGED",
      title: `Quote v${quote.version} reverted to draft`,
      metadata: { quoteId, from: previousStatus, to: "DRAFT" },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  revalidatePath("/bookings");
  if (quote.trip.contactId) revalidatePath(`/contacts/${quote.trip.contactId}`);
  return { ok: true as const };
}

/**
 * Public-facing accept — called from the customer's view of /share/[token].
 * Only requires the unguessable shareToken, so a malicious caller would need
 * to know the token; same security model as the share link itself.
 *
 * Idempotent: re-accepting an already-accepted quote returns ok rather than
 * erroring (customers double-tap mobile buttons constantly).
 */
export async function acceptQuoteByTokenAction(token: string) {
  if (!token || token.length < 8) {
    return { ok: false as const, error: "Invalid link" };
  }

  const quote = await prisma.quote.findUnique({
    where: { shareToken: token },
    include: { trip: { select: { id: true, contactId: true } } },
  });
  if (!quote) return { ok: false as const, error: "Quote not found" };

  if (quote.status === "ACCEPTED") {
    return { ok: true as const, alreadyAccepted: true as const };
  }
  if (quote.status === "REJECTED" || quote.status === "EXPIRED") {
    return {
      ok: false as const,
      error: "This quote is no longer available — please get in touch.",
    };
  }

  const existingBooking = await prisma.booking.findFirst({
    where: { tripId: quote.tripId, status: { not: "CANCELLED" } },
  });
  if (existingBooking) {
    return {
      ok: false as const,
      error: "This trip already has an active booking — please get in touch.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED" },
    });
    const booking = await tx.booking.create({
      data: {
        tripId: quote.tripId,
        quoteId: quote.id,
        status: "PENDING",
        totalAmount: quote.sellingPrice,
      },
    });
    await tx.trip.update({
      where: { id: quote.tripId },
      data: { status: "BOOKED" },
    });
    await seedVendorAssignmentsFromQuote(tx, {
      tripId: quote.tripId,
      quoteId: quote.id,
      bookingId: booking.id,
    });
  });

  if (quote.trip.contactId) {
    await recomputeContactStatus(quote.trip.contactId);
    await logActivity({
      contactId: quote.trip.contactId,
      type: "QUOTE_ACCEPTED",
      title: `Customer accepted quote v${quote.version} (via share link)`,
      metadata: { quoteId: quote.id, version: quote.version, source: "public_share" },
    });
    await logActivity({
      contactId: quote.trip.contactId,
      type: "BOOKING_CREATED",
      title: "Booking created from public accept",
      metadata: { quoteId: quote.id, tripId: quote.tripId },
    });
  }

  revalidatePath(`/share/${token}`);
  revalidatePath(`/trips/${quote.tripId}`);
  if (quote.trip.contactId) revalidatePath(`/contacts/${quote.trip.contactId}`);
  return { ok: true as const };
}

export async function generateShareTokenAction(quoteId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("quote:share");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    select: { id: true, shareToken: true, tripId: true },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.shareToken) return { token: quote.shareToken };

  // Retry on the (very unlikely) collision against the @unique constraint.
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = randomBytes(18).toString("base64url");
    try {
      await prisma.quote.update({
        where: { id: quoteId },
        data: { shareToken: token },
      });
      revalidatePath(`/trips/${quote.tripId}`);
      return { token };
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  throw new Error("Could not generate share token");
}
