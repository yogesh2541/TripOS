import "server-only";
import type {
  ActivityType,
  OperationTaskPriority,
  OperationTaskStatus,
  TripStatus,
  VendorAssignmentStatus,
  VendorAssignmentCategory,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DepartureRow = {
  tripId: string;
  destination: string;
  startDate: Date;
  days: number;
  travelers: number;
  status: TripStatus;
  leadName: string | null;
  confirmedCount: number;
  totalCount: number;
};

export type InProgressTrip = {
  tripId: string;
  destination: string;
  startDate: Date | null;
  endDate: Date | null;
  days: number;
  status: TripStatus;
  leadName: string | null;
};

export type PendingAssignment = {
  id: string;
  tripId: string;
  tripDestination: string;
  category: VendorAssignmentCategory;
  status: VendorAssignmentStatus;
  title: string;
  startDate: Date | null;
  vendor: { id: string; name: string };
};

export type OverdueTask = {
  id: string;
  tripId: string;
  tripDestination: string;
  title: string;
  status: OperationTaskStatus;
  priority: OperationTaskPriority;
  dueDate: Date | null;
};

export type VendorBalanceRow = {
  vendorId: string;
  vendorName: string;
  committed: number;
  paid: number;
  outstanding: number;
};

export type DashboardActivity = {
  id: string;
  type: ActivityType;
  title: string;
  body: string | null;
  createdAt: Date;
  trip: { id: string; destination: string } | null;
};

export type CalendarDay = {
  date: Date;
  isToday: boolean;
  departures: { tripId: string; destination: string; leadName: string | null }[];
  endsToday: { tripId: string; destination: string }[];
};

export type DashboardSnapshot = {
  today: Date;
  stats: {
    departuresToday: number;
    inProgress: number;
    awaitingConfirmation: number;
    overdueTasks: number;
    unpaidVendorBalance: number;
  };
  departuresToday: DepartureRow[];
  inProgress: InProgressTrip[];
  shouldStartToday: InProgressTrip[];
  shouldComplete: InProgressTrip[];
  pendingAssignments: PendingAssignment[];
  overdueTasks: OverdueTask[];
  vendorBalances: VendorBalanceRow[];
  recentActivity: DashboardActivity[];
  calendar: CalendarDay[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * DAY_MS);
}

export async function getOperationsDashboard(): Promise<DashboardSnapshot> {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const horizonEnd = addDays(today, 14);

  const [
    todayDepartures,
    inProgress,
    upcomingForCalendar,
    pending,
    overdueTasks,
    recentActivity,
    confirmedTrips, // for "should mark started" / "should mark completed"
    vendorAggCommitted,
    vendorAggPaid,
  ] = await Promise.all([
    prisma.trip.findMany({
      where: {
        deletedAt: null,
        startDate: { gte: today, lt: tomorrow },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        destination: true,
        startDate: true,
        days: true,
        travelers: true,
        status: true,
        lead: { select: { name: true } },
        vendorAssignments: {
          where: { status: { not: "CANCELLED" } },
          select: { status: true },
        },
      },
    }),

    prisma.trip.findMany({
      where: { deletedAt: null, status: "IN_PROGRESS" },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        destination: true,
        startDate: true,
        days: true,
        status: true,
        lead: { select: { name: true } },
      },
    }),

    prisma.trip.findMany({
      where: {
        deletedAt: null,
        startDate: { gte: today, lt: addDays(today, 14) },
        status: { notIn: ["CANCELLED"] },
      },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        destination: true,
        startDate: true,
        days: true,
        status: true,
        lead: { select: { name: true } },
      },
    }),

    prisma.vendorAssignment.findMany({
      where: {
        status: { in: ["PENDING", "REQUESTED"] },
        trip: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        category: true,
        status: true,
        title: true,
        startDate: true,
        vendor: { select: { id: true, name: true } },
        trip: { select: { id: true, destination: true } },
      },
    }),

    prisma.operationTask.findMany({
      where: {
        status: { not: "COMPLETED" },
        dueDate: { lt: now },
        trip: {
          deletedAt: null,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        trip: { select: { id: true, destination: true } },
      },
    }),

    prisma.activity.findMany({
      where: {
        type: {
          in: [
            "VENDOR_ASSIGNED",
            "VENDOR_CONFIRMED",
            "VENDOR_CANCELLED",
            "VOUCHER_GENERATED",
            "VOUCHER_SENT",
            "VENDOR_PAYMENT_ADDED",
            "OPS_TASK_COMPLETED",
            "TRIP_READY",
            "TRIP_STARTED",
            "TRIP_COMPLETED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 14,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        createdAt: true,
        trip: { select: { id: true, destination: true } },
      },
    }),

    // Trips ready to be moved through the lifecycle.
    prisma.trip.findMany({
      where: {
        deletedAt: null,
        status: { in: ["READY_TO_TRAVEL", "IN_PROGRESS"] },
        startDate: { not: null },
      },
      select: {
        id: true,
        destination: true,
        startDate: true,
        days: true,
        status: true,
        lead: { select: { name: true } },
      },
    }),

    prisma.vendorAssignment.groupBy({
      by: ["vendorId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { totalCost: true },
    }),

    prisma.vendorPayment.groupBy({
      by: ["vendorId"],
      _sum: { amount: true },
    }),
  ]);

  // Vendor balances
  const paidByVendor = new Map<string, number>();
  for (const r of vendorAggPaid) {
    paidByVendor.set(r.vendorId, r._sum.amount ?? 0);
  }
  const balanceVendorIds = vendorAggCommitted.map((r) => r.vendorId);
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: balanceVendorIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(vendors.map((v) => [v.id, v.name] as const));

  const vendorBalances: VendorBalanceRow[] = vendorAggCommitted
    .map((r) => {
      const committed = r._sum.totalCost ?? 0;
      const paid = paidByVendor.get(r.vendorId) ?? 0;
      const outstanding = Math.max(0, committed - paid);
      return {
        vendorId: r.vendorId,
        vendorName: nameById.get(r.vendorId) ?? "Vendor",
        committed,
        paid,
        outstanding,
      };
    })
    .filter((r) => r.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8);

  const totalUnpaid = vendorBalances.reduce((s, r) => s + r.outstanding, 0);

  // Trip lifecycle suggestions
  const shouldStartToday: InProgressTrip[] = confirmedTrips
    .filter(
      (t) =>
        t.status === "READY_TO_TRAVEL" &&
        t.startDate &&
        t.startDate <= endOfDay(now)
    )
    .map((t) => ({
      tripId: t.id,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.startDate ? addDays(t.startDate, t.days) : null,
      days: t.days,
      status: t.status,
      leadName: t.lead?.name ?? null,
    }));

  const shouldComplete: InProgressTrip[] = confirmedTrips
    .filter((t) => {
      if (t.status !== "IN_PROGRESS") return false;
      if (!t.startDate) return false;
      const endDate = addDays(t.startDate, t.days);
      return endDate < today;
    })
    .map((t) => ({
      tripId: t.id,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.startDate ? addDays(t.startDate, t.days) : null,
      days: t.days,
      status: t.status,
      leadName: t.lead?.name ?? null,
    }));

  // Build calendar (14 days)
  const calendar: CalendarDay[] = [];
  const upcomingByStartKey = new Map<string, typeof upcomingForCalendar>();
  for (const t of upcomingForCalendar) {
    if (!t.startDate) continue;
    const k = startOfDay(t.startDate).toISOString();
    const arr = upcomingByStartKey.get(k) ?? [];
    arr.push(t);
    upcomingByStartKey.set(k, arr);
  }

  // For end-of-trip markers we need trips whose start+days lands within window
  const endingTrips = await prisma.trip.findMany({
    where: {
      deletedAt: null,
      startDate: {
        gte: addDays(today, -30),
        lt: horizonEnd,
      },
      status: { notIn: ["CANCELLED"] },
    },
    select: { id: true, destination: true, startDate: true, days: true },
  });
  const endsByKey = new Map<string, { tripId: string; destination: string }[]>();
  for (const t of endingTrips) {
    if (!t.startDate) continue;
    const end = startOfDay(addDays(t.startDate, t.days));
    if (end < today || end >= horizonEnd) continue;
    const k = end.toISOString();
    const arr = endsByKey.get(k) ?? [];
    arr.push({ tripId: t.id, destination: t.destination });
    endsByKey.set(k, arr);
  }

  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const k = d.toISOString();
    calendar.push({
      date: d,
      isToday: i === 0,
      departures: (upcomingByStartKey.get(k) ?? []).map((t) => ({
        tripId: t.id,
        destination: t.destination,
        leadName: t.lead?.name ?? null,
      })),
      endsToday: endsByKey.get(k) ?? [],
    });
  }

  // Departures for stats / list
  const departuresToday: DepartureRow[] = todayDepartures.map((t) => {
    const total = t.vendorAssignments.length;
    const confirmed = t.vendorAssignments.filter(
      (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
    ).length;
    return {
      tripId: t.id,
      destination: t.destination,
      startDate: t.startDate as Date,
      days: t.days,
      travelers: t.travelers,
      status: t.status,
      leadName: t.lead?.name ?? null,
      confirmedCount: confirmed,
      totalCount: total,
    };
  });

  return {
    today,
    stats: {
      departuresToday: departuresToday.length,
      inProgress: inProgress.length,
      awaitingConfirmation: pending.length,
      overdueTasks: overdueTasks.length,
      unpaidVendorBalance: totalUnpaid,
    },
    departuresToday,
    inProgress: inProgress.map((t) => ({
      tripId: t.id,
      destination: t.destination,
      startDate: t.startDate,
      endDate: t.startDate ? addDays(t.startDate, t.days) : null,
      days: t.days,
      status: t.status,
      leadName: t.lead?.name ?? null,
    })),
    shouldStartToday,
    shouldComplete,
    pendingAssignments: pending.map((p) => ({
      id: p.id,
      tripId: p.trip.id,
      tripDestination: p.trip.destination,
      category: p.category,
      status: p.status,
      title: p.title,
      startDate: p.startDate,
      vendor: p.vendor,
    })),
    overdueTasks: overdueTasks.map((t) => ({
      id: t.id,
      tripId: t.trip.id,
      tripDestination: t.trip.destination,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
    })),
    vendorBalances,
    recentActivity: recentActivity.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      trip: a.trip ? { id: a.trip.id, destination: a.trip.destination } : null,
    })),
    calendar,
  };
}
