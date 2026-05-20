import "server-only";
import {
  type ActivityType,
  type OperationTaskPriority,
  type OperationTaskStatus,
  type OperationTaskType,
  type VendorAssignmentCategory,
  type VendorAssignmentStatus,
  type VendorType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AssignmentVoucher = {
  id: string;
  voucherNumber: string;
  shareToken: string;
  generatedAt: Date;
  sentAt: Date | null;
  downloadCount: number;
};

export type AssignmentRow = {
  id: string;
  category: VendorAssignmentCategory;
  status: VendorAssignmentStatus;
  title: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  quantity: number | null;
  unitCost: number | null;
  totalCost: number | null;
  sellingPrice: number | null;
  confirmationNumber: string | null;
  voucherSent: boolean;
  customerVisible: boolean;
  notes: string | null;
  vendor: {
    id: string;
    name: string;
    type: VendorType;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    isPreferred: boolean;
  };
  vouchersCount: number;
  vouchers: AssignmentVoucher[];
};

export type ChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  type: OperationTaskType;
  status: OperationTaskStatus;
  priority: OperationTaskPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type TimelineEntry = {
  id: string;
  type: ActivityType;
  title: string;
  body: string | null;
  createdAt: Date;
};

export type TripOpsSnapshot = {
  trip: {
    id: string;
    destination: string;
    days: number;
    startDate: Date | null;
    status:
      | "PLANNING"
      | "QUOTED"
      | "BOOKED"
      | "VENDOR_CONFIRMATION_PENDING"
      | "PARTIALLY_CONFIRMED"
      | "READY_TO_TRAVEL"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "CANCELLED";
    travelers: number;
  };
  assignments: AssignmentRow[];
  stats: TripOpsStats;
  vendorPickerOptions: VendorOption[];
  checklist: ChecklistItem[];
  timeline: TimelineEntry[];
};

export type TripOpsStats = {
  totalAssignments: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalCost: number;
  totalSelling: number;
  grossProfit: number;
  voucherCompletionPct: number;
  confirmationProgressPct: number;
};

export type VendorOption = {
  id: string;
  name: string;
  type: VendorType;
  city: string | null;
  isPreferred: boolean;
};

export async function getTripOperations(
  tripId: string
): Promise<TripOpsSnapshot | null> {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: {
      id: true,
      destination: true,
      days: true,
      startDate: true,
      status: true,
      travelers: true,
    },
  });
  if (!trip) return null;

  const [assignmentsRaw, vendors, checklistRaw, timelineRaw] =
    await Promise.all([
      prisma.vendorAssignment.findMany({
        where: { tripId },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              type: true,
              phone: true,
              whatsapp: true,
              email: true,
              isPreferred: true,
            },
          },
          vouchers: {
            orderBy: { generatedAt: "desc" },
            select: {
              id: true,
              voucherNumber: true,
              shareToken: true,
              generatedAt: true,
              sentAt: true,
              downloadCount: true,
            },
          },
          _count: { select: { vouchers: true } },
        },
      }),
      prisma.vendor.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: [{ isPreferred: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          city: true,
          isPreferred: true,
        },
      }),
      prisma.operationTask.findMany({
        where: { tripId },
        orderBy: [
          { status: "asc" }, // PENDING first
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      prisma.activity.findMany({
        where: {
          tripId,
          type: {
            in: [
              "VENDOR_ASSIGNED",
              "VENDOR_CONFIRMED",
              "VENDOR_CANCELLED",
              "VOUCHER_GENERATED",
              "VOUCHER_SENT",
              "VENDOR_PAYMENT_ADDED",
              "OPS_TASK_CREATED",
              "OPS_TASK_COMPLETED",
              "TRIP_READY",
              "TRIP_STARTED",
              "TRIP_COMPLETED",
              "STATUS_CHANGED",
              "PAYMENT_RECORDED",
              "BOOKING_CREATED",
              "CUSTOM",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          createdAt: true,
        },
      }),
    ]);

  const assignments: AssignmentRow[] = assignmentsRaw.map((a) => ({
    id: a.id,
    category: a.category,
    status: a.status,
    title: a.title,
    description: a.description,
    startDate: a.startDate,
    endDate: a.endDate,
    quantity: a.quantity,
    unitCost: a.unitCost,
    totalCost: a.totalCost,
    sellingPrice: a.sellingPrice,
    confirmationNumber: a.confirmationNumber,
    voucherSent: a.voucherSent,
    customerVisible: a.customerVisible,
    notes: a.notes,
    vendor: a.vendor,
    vouchersCount: a._count.vouchers,
    vouchers: a.vouchers,
  }));

  const stats = computeTripOpsStats(assignments);

  return {
    trip,
    assignments,
    stats,
    vendorPickerOptions: vendors,
    checklist: checklistRaw,
    timeline: timelineRaw,
  };
}

export function computeTripOpsStats(
  assignments: Pick<
    AssignmentRow,
    "status" | "totalCost" | "sellingPrice" | "voucherSent"
  >[]
): TripOpsStats {
  const live = assignments.filter((a) => a.status !== "CANCELLED");

  const confirmedCount = live.filter(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  ).length;
  const pendingCount = live.filter(
    (a) => a.status === "PENDING" || a.status === "REQUESTED"
  ).length;
  const cancelledCount = assignments.length - live.length;

  const totalCost = live.reduce((s, a) => s + (a.totalCost ?? 0), 0);
  const totalSelling = live.reduce((s, a) => s + (a.sellingPrice ?? 0), 0);
  const grossProfit = totalSelling - totalCost;

  const voucherTarget = live.filter(
    (a) => a.status === "CONFIRMED" || a.status === "COMPLETED"
  ).length;
  const voucherCompletionPct =
    voucherTarget === 0
      ? 0
      : Math.round(
          (live.filter((a) => a.voucherSent).length / voucherTarget) * 100
        );

  const confirmationProgressPct =
    live.length === 0
      ? 0
      : Math.round((confirmedCount / live.length) * 100);

  return {
    totalAssignments: assignments.length,
    confirmedCount,
    pendingCount,
    cancelledCount,
    totalCost,
    totalSelling,
    grossProfit,
    voucherCompletionPct,
    confirmationProgressPct,
  };
}
