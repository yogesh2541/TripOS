import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import type { VendorAssignmentCategory } from "@prisma/client";

/** Snapshot stored in Voucher.content — frozen at generation time. */
export type VoucherSnapshot = {
  voucherNumber: string;
  generatedAt: string; // ISO

  agency: {
    name: string;
    phone: string;
    email: string;
    emergencyPhone: string;
  };

  traveler: {
    leadName: string | null;
    phone: string | null;
    email: string | null;
    travelers: number;
  };

  trip: {
    id: string;
    destination: string;
    startDate: string | null;
    days: number;
  };

  vendor: {
    name: string;
    type: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };

  service: {
    category: VendorAssignmentCategory;
    title: string;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    quantity: number | null;
    confirmationNumber: string | null;
  };
};

const AGENCY = {
  name: "TripCraft",
  phone: "+91 80000 00000",
  email: "concierge@tripcraft.app",
  emergencyPhone: "+91 80000 00000",
};

function newVoucherNumber(prefix: string) {
  // e.g. TC-HOT-2A4B7C
  const id = randomBytes(3).toString("hex").toUpperCase();
  return `TC-${prefix}-${id}`;
}

const PREFIX_BY_CATEGORY: Record<VendorAssignmentCategory, string> = {
  HOTEL: "HOT",
  TRANSFER: "TRF",
  SIGHTSEEING: "SGT",
  ACTIVITY: "ACT",
  GUIDE: "GDE",
  FLIGHT: "FLT",
  TRAIN: "TRN",
  OTHER: "VCH",
};

export async function buildVoucherSnapshot(
  assignmentId: string
): Promise<VoucherSnapshot> {
  const a = await prisma.vendorAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      vendor: true,
      trip: {
        include: {
          contact: {
            select: { name: true, phone: true, email: true },
          },
        },
      },
    },
  });
  if (!a) throw new Error("Assignment not found");

  return {
    voucherNumber: newVoucherNumber(PREFIX_BY_CATEGORY[a.category]),
    generatedAt: new Date().toISOString(),
    agency: AGENCY,
    traveler: {
      leadName: a.trip.contact?.name ?? null,
      phone: a.trip.contact?.phone ?? null,
      email: a.trip.contact?.email ?? null,
      travelers: a.trip.travelers,
    },
    trip: {
      id: a.trip.id,
      destination: a.trip.destination,
      startDate: a.trip.startDate?.toISOString() ?? null,
      days: a.trip.days,
    },
    vendor: {
      name: a.vendor.name,
      type: a.vendor.type,
      phone: a.vendor.phone,
      whatsapp: a.vendor.whatsapp,
      email: a.vendor.email,
      address: a.vendor.address,
      city: a.vendor.city,
      state: a.vendor.state,
      country: a.vendor.country,
    },
    service: {
      category: a.category,
      title: a.title,
      description: a.description,
      startDate: a.startDate?.toISOString() ?? null,
      endDate: a.endDate?.toISOString() ?? null,
      quantity: a.quantity,
      confirmationNumber: a.confirmationNumber,
    },
  };
}

export function shareTokenFromBytes() {
  return randomBytes(24).toString("base64url");
}

export function publicShareUrl(token: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/v/${token}`;
}

export async function getVoucherByToken(token: string) {
  return prisma.voucher.findUnique({
    where: { shareToken: token },
    include: {
      assignment: {
        select: {
          id: true,
          tripId: true,
          status: true,
          customerVisible: true,
        },
      },
    },
  });
}

export async function getVoucherById(id: string) {
  return prisma.voucher.findUnique({
    where: { id },
    include: {
      assignment: {
        select: {
          id: true,
          tripId: true,
          status: true,
          customerVisible: true,
        },
      },
    },
  });
}
