"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCan, requireAgency } from "@/lib/session";
import {
  cancelRazorpayPaymentLink,
  createRazorpayPaymentLink,
} from "@/lib/razorpay";
import { getAgencyRazorpayConfig } from "@/server/services/integrations";

const createSchema = z.object({
  bookingId: z.string(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  description: z.string().max(200).optional().nullable(),
});

export type CreatePaymentLinkInput = z.infer<typeof createSchema>;

export async function createPaymentLinkAction(input: CreatePaymentLinkInput) {
  const data = createSchema.parse(input);
  const { agencyId, user } = await requireAgency();
  await assertCan("payment:create");

  const rzp = await getAgencyRazorpayConfig(agencyId);
  if (!rzp.configured || !rzp.credentials) {
    return {
      ok: false as const,
      error:
        "Online payments aren't connected. Add your Razorpay keys in Settings → Integrations.",
    };
  }
  const rzpKeys = {
    keyId: rzp.credentials.keyId,
    keySecret: rzp.credentials.keySecret,
  };

  const booking = await prisma.booking.findFirst({
    where: { id: data.bookingId, trip: { agencyId } },
    include: {
      trip: {
        select: {
          destination: true,
          contact: { select: { name: true, phone: true, email: true } },
        },
      },
    },
  });
  if (!booking) return { ok: false as const, error: "Booking not found." };
  if (booking.status === "CANCELLED") {
    return { ok: false as const, error: "Booking is cancelled." };
  }

  const description =
    data.description?.trim() ||
    `${booking.trip.destination} — trip payment`;

  // Create our row first so we can stamp our id into Razorpay's notes for a
  // reliable webhook round-trip, then attach the provider details.
  const link = await prisma.paymentLink.create({
    data: {
      agencyId,
      bookingId: booking.id,
      amount: data.amount,
      description,
      status: "CREATED",
      createdById: user.id,
    },
  });

  try {
    const created = await createRazorpayPaymentLink({
      amountRupees: data.amount,
      description,
      customer: {
        name: booking.trip.contact?.name,
        phone: booking.trip.contact?.phone,
        email: booking.trip.contact?.email,
      },
      notes: {
        bookingId: booking.id,
        paymentLinkId: link.id,
        agencyId,
      },
    }, rzpKeys);

    const updated = await prisma.paymentLink.update({
      where: { id: link.id },
      data: { providerLinkId: created.id, shortUrl: created.shortUrl },
    });

    revalidatePath(`/trips/${booking.tripId}`);
    return {
      ok: true as const,
      id: updated.id,
      shortUrl: updated.shortUrl!,
    };
  } catch (e) {
    // Roll back the placeholder so we don't leave a dangling CREATED link.
    await prisma.paymentLink.delete({ where: { id: link.id } }).catch(() => {});
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Couldn't create payment link.",
    };
  }
}

export async function cancelPaymentLinkAction(linkId: string) {
  const { agencyId } = await requireAgency();
  await assertCan("payment:create");

  const link = await prisma.paymentLink.findFirst({
    where: { id: linkId, agencyId },
    select: { id: true, status: true, providerLinkId: true, bookingId: true },
  });
  if (!link) return { ok: false as const, error: "Link not found." };
  if (link.status === "PAID") {
    return { ok: false as const, error: "This link is already paid." };
  }

  if (link.providerLinkId) {
    const rzp = await getAgencyRazorpayConfig(agencyId);
    await cancelRazorpayPaymentLink(
      link.providerLinkId,
      rzp.credentials
        ? { keyId: rzp.credentials.keyId, keySecret: rzp.credentials.keySecret }
        : undefined
    );
  }
  await prisma.paymentLink.update({
    where: { id: link.id },
    data: { status: "CANCELLED" },
  });

  const booking = await prisma.booking.findUnique({
    where: { id: link.bookingId },
    select: { tripId: true },
  });
  if (booking) revalidatePath(`/trips/${booking.tripId}`);
  return { ok: true as const };
}
