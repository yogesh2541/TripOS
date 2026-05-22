import "server-only";
import type { TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type WorkflowStepKey =
  | "contact"
  | "quote"
  | "book"
  | "assign"
  | "confirm"
  | "voucher"
  | "travel"
  | "complete";

export type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  done: boolean;
  current: boolean;
  hint: string;
};

export type NextAction = {
  label: string;
  description: string;
  href?: string;
  scrollTarget?: "operations" | "plan";
} | null;

export type TripWorkflow = {
  steps: WorkflowStep[];
  nextAction: NextAction;
  // Useful aggregates (callers can avoid a 2nd query)
  signals: {
    quotesCount: number;
    activeBookingId: string | null;
    assignmentCount: number;
    confirmedCount: number;
    voucherCount: number;
    voucherSentCount: number;
    tripStatus: TripStatus;
  };
};

export async function getTripWorkflow(tripId: string): Promise<TripWorkflow | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: {
      id: true,
      status: true,
      destination: true,
      _count: {
        select: {
          quotes: true,
        },
      },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true },
        take: 1,
      },
      vendorAssignments: {
        select: {
          id: true,
          status: true,
          voucherSent: true,
          _count: { select: { vouchers: true } },
        },
      },
    },
  });
  if (!trip) return null;

  const quotesCount = trip._count.quotes;
  const activeBookingId = trip.bookings[0]?.id ?? null;
  const assignments = trip.vendorAssignments.filter((a) => a.status !== "CANCELLED");
  const assignmentCount = assignments.length;
  const confirmedCount = assignments.filter(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  ).length;
  const voucherCount = assignments.reduce(
    (s, a) => s + a._count.vouchers,
    0
  );
  const voucherSentCount = assignments.filter((a) => a.voucherSent).length;

  // Derive done flags
  const hasLead = true; // trips always link to a contact in this codebase
  const hasQuote = quotesCount > 0;
  const isBooked = !!activeBookingId;
  const hasAssignments = assignmentCount > 0;
  const allConfirmed =
    assignmentCount > 0 && confirmedCount === assignmentCount;
  const hasVouchers = voucherCount > 0;
  const isInProgress =
    trip.status === "IN_PROGRESS" || trip.status === "READY_TO_TRAVEL";
  const isCompleted = trip.status === "COMPLETED";

  const steps: WorkflowStep[] = [
    {
      key: "contact",
      label: "Contact",
      done: hasLead,
      current: false,
      hint: "Inquiry captured",
    },
    {
      key: "quote",
      label: "Quote",
      done: hasQuote,
      current: false,
      hint: hasQuote ? `${quotesCount} version${quotesCount === 1 ? "" : "s"}` : "Build pricing",
    },
    {
      key: "book",
      label: "Book",
      done: isBooked,
      current: false,
      hint: isBooked ? "Booking active" : "Accept a quote to book",
    },
    {
      key: "assign",
      label: "Assign",
      done: hasAssignments,
      current: false,
      hint: hasAssignments
        ? `${assignmentCount} vendor${assignmentCount === 1 ? "" : "s"}`
        : "Pick suppliers",
    },
    {
      key: "confirm",
      label: "Confirm",
      done: allConfirmed,
      current: false,
      hint: hasAssignments
        ? `${confirmedCount}/${assignmentCount} confirmed`
        : "After assigning",
    },
    {
      key: "voucher",
      label: "Voucher",
      done: hasVouchers && voucherSentCount > 0,
      current: false,
      hint: hasVouchers
        ? `${voucherSentCount}/${voucherCount} sent`
        : "Generate after confirm",
    },
    {
      key: "travel",
      label: "Travel",
      done: isInProgress || isCompleted,
      current: false,
      hint: isInProgress ? "Trip underway" : "Mark when traveler departs",
    },
    {
      key: "complete",
      label: "Wrap",
      done: isCompleted,
      current: false,
      hint: isCompleted ? "Closed" : "Mark when trip ends",
    },
  ];

  // First non-done step is "current"
  const firstUndoneIdx = steps.findIndex((s) => !s.done);
  if (firstUndoneIdx >= 0) steps[firstUndoneIdx].current = true;

  // Compute next-action CTA
  let nextAction: NextAction = null;
  if (!hasQuote) {
    nextAction = {
      label: "Build first quote",
      description: "Add line items and a markup to send pricing.",
      scrollTarget: "plan",
    };
  } else if (!isBooked) {
    nextAction = {
      label: "Accept a quote to book",
      description: "When the traveler confirms, mark a quote accepted to create the booking.",
      scrollTarget: "plan",
    };
  } else if (!hasAssignments) {
    nextAction = {
      label: "Assign your first vendor",
      description: "Open the Operations tab to start booking suppliers.",
      scrollTarget: "operations",
    };
  } else if (!allConfirmed) {
    nextAction = {
      label: `Confirm ${assignmentCount - confirmedCount} more vendor${
        assignmentCount - confirmedCount === 1 ? "" : "s"
      }`,
      description: "Push pending assignments through to CONFIRMED.",
      scrollTarget: "operations",
    };
  } else if (!hasVouchers) {
    nextAction = {
      label: "Generate vouchers",
      description: "All vendors are confirmed — generate PDFs to share with travelers.",
      scrollTarget: "operations",
    };
  } else if (voucherSentCount < voucherCount) {
    nextAction = {
      label: `Send ${voucherCount - voucherSentCount} more voucher${
        voucherCount - voucherSentCount === 1 ? "" : "s"
      }`,
      description: "Mark vouchers as sent once the traveler has them.",
      scrollTarget: "operations",
    };
  } else if (!isInProgress && !isCompleted) {
    nextAction = {
      label: "Mark trip in progress when traveler departs",
      description: "Status will move to IN_PROGRESS.",
    };
  } else if (
    trip.status === "IN_PROGRESS" ||
    trip.status === "READY_TO_TRAVEL"
  ) {
    nextAction = {
      label: "Mark trip completed when it wraps",
      description: "Closes out the booking lifecycle.",
    };
  }

  return {
    steps,
    nextAction,
    signals: {
      quotesCount,
      activeBookingId,
      assignmentCount,
      confirmedCount,
      voucherCount,
      voucherSentCount,
      tripStatus: trip.status,
    },
  };
}
