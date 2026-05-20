"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { computePricing, type PricingItem } from "@/types";
import { logActivity } from "@/server/helpers/log-activity";

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
});

export type SaveQuoteInput = z.infer<typeof saveSchema>;

export async function saveQuoteAction(input: SaveQuoteInput) {
  const data = saveSchema.parse(input);
  const summary = computePricing({
    items: data.items as PricingItem[],
    markupPct: data.markupPct,
    discountPct: data.discountPct,
  });

  let quoteId = data.quoteId;

  if (quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
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
      },
    }),
  ]);

  revalidatePath(`/trips/${data.tripId}`);
  revalidatePath(`/trips/${data.tripId}/preview`);
  return { quoteId, summary };
}

export async function duplicateQuoteAction(quoteId: string) {
  const source = await prisma.quote.findUnique({
    where: { id: quoteId },
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
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "ACCEPTED") {
    throw new Error("Can't delete an accepted quote — cancel its booking first");
  }
  await prisma.quote.delete({ where: { id: quoteId } });
  revalidatePath(`/trips/${quote.tripId}`);
  return { ok: true as const };
}

export async function markQuoteSentAction(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { trip: { select: { id: true, leadId: true, status: true } } },
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

  if (quote.trip.leadId) {
    await prisma.lead.update({
      where: { id: quote.trip.leadId },
      data: { status: "QUOTED" },
    });
    await logActivity({
      leadId: quote.trip.leadId,
      type: "QUOTE_SENT",
      title: `Quote v${quote.version} marked sent`,
      metadata: { quoteId, tripId: quote.tripId, version: quote.version },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  if (quote.trip.leadId) revalidatePath(`/leads/${quote.trip.leadId}`);
  return { ok: true as const };
}

export async function rejectQuoteAction(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { trip: { select: { id: true, leadId: true } } },
  });
  if (!quote) throw new Error("Quote not found");

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "REJECTED" },
  });

  if (quote.trip.leadId) {
    await logActivity({
      leadId: quote.trip.leadId,
      type: "STATUS_CHANGED",
      title: `Quote v${quote.version} rejected`,
      metadata: { quoteId, version: quote.version },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  return { ok: true as const };
}

export async function acceptQuoteAction(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { trip: { select: { id: true, leadId: true } } },
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
    await tx.booking.create({
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
  });

  if (quote.trip.leadId) {
    await prisma.lead.update({
      where: { id: quote.trip.leadId },
      data: { status: "WON" },
    });
    await logActivity({
      leadId: quote.trip.leadId,
      type: "QUOTE_ACCEPTED",
      title: `Quote v${quote.version} accepted`,
      metadata: { quoteId, version: quote.version },
    });
    await logActivity({
      leadId: quote.trip.leadId,
      type: "BOOKING_CREATED",
      title: "Booking created",
      metadata: { quoteId, tripId: quote.tripId },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  if (quote.trip.leadId) revalidatePath(`/leads/${quote.trip.leadId}`);
  return { ok: true as const };
}

export async function revertQuoteToDraftAction(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      trip: { select: { id: true, leadId: true } },
      booking: { include: { payments: { take: 1 } } },
    },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "DRAFT") return { ok: true as const };

  const previousStatus = quote.status;

  // Reverting an ACCEPTED quote tears down the auto-created booking
  // and walks the trip/lead status back. Block if any payments exist —
  // the agent should clear those first so we don't silently lose money trail.
  if (quote.status === "ACCEPTED") {
    if (quote.booking && quote.booking.payments.length > 0) {
      throw new Error(
        "Can't revert — this booking has recorded payments. Delete the payments first."
      );
    }
    await prisma.$transaction(async (tx) => {
      if (quote.booking) {
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

    if (quote.trip.leadId) {
      // Walk Lead status back to QUOTED only if it's currently WON.
      // Don't touch LOST or earlier states.
      const lead = await prisma.lead.findUnique({
        where: { id: quote.trip.leadId },
        select: { status: true },
      });
      if (lead?.status === "WON") {
        await prisma.lead.update({
          where: { id: quote.trip.leadId },
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

  if (quote.trip.leadId) {
    await logActivity({
      leadId: quote.trip.leadId,
      type: "STATUS_CHANGED",
      title: `Quote v${quote.version} reverted to draft`,
      metadata: { quoteId, from: previousStatus, to: "DRAFT" },
    });
  }

  revalidatePath(`/trips/${quote.tripId}`);
  revalidatePath(`/trips/${quote.tripId}/preview`);
  revalidatePath("/bookings");
  if (quote.trip.leadId) revalidatePath(`/leads/${quote.trip.leadId}`);
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
    include: { trip: { select: { id: true, leadId: true } } },
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
    await tx.booking.create({
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
  });

  if (quote.trip.leadId) {
    await prisma.lead.update({
      where: { id: quote.trip.leadId },
      data: { status: "WON" },
    });
    await logActivity({
      leadId: quote.trip.leadId,
      type: "QUOTE_ACCEPTED",
      title: `Customer accepted quote v${quote.version} (via share link)`,
      metadata: { quoteId: quote.id, version: quote.version, source: "public_share" },
    });
    await logActivity({
      leadId: quote.trip.leadId,
      type: "BOOKING_CREATED",
      title: "Booking created from public accept",
      metadata: { quoteId: quote.id, tripId: quote.tripId },
    });
  }

  revalidatePath(`/share/${token}`);
  revalidatePath(`/trips/${quote.tripId}`);
  if (quote.trip.leadId) revalidatePath(`/leads/${quote.trip.leadId}`);
  return { ok: true as const };
}

export async function generateShareTokenAction(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
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
