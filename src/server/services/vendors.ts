import "server-only";
import { Prisma, type VendorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type VendorListFilters = {
  search?: string;
  type?: VendorType | "ALL";
  status?: "all" | "active" | "inactive" | "preferred";
};

export type VendorListItem = {
  id: string;
  name: string;
  type: VendorType;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: Date;
  assignmentsCount: number;
  paidTotal: number;
};

export async function listVendors(
  filters: VendorListFilters = {}
): Promise<VendorListItem[]> {
  const where: Prisma.VendorWhereInput = { deletedAt: null };

  if (filters.type && filters.type !== "ALL") {
    where.type = filters.type;
  }
  if (filters.status === "active") where.isActive = true;
  if (filters.status === "inactive") where.isActive = false;
  if (filters.status === "preferred") where.isPreferred = true;

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: [{ isPreferred: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      country: true,
      phone: true,
      whatsapp: true,
      email: true,
      isPreferred: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignments: true } },
      payments: { select: { amount: true } },
    },
  });

  return vendors.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    city: v.city,
    state: v.state,
    country: v.country,
    phone: v.phone,
    whatsapp: v.whatsapp,
    email: v.email,
    isPreferred: v.isPreferred,
    isActive: v.isActive,
    createdAt: v.createdAt,
    assignmentsCount: v._count.assignments,
    paidTotal: v.payments.reduce((s, p) => s + p.amount, 0),
  }));
}

export type VendorStats = {
  total: number;
  active: number;
  preferred: number;
  pendingPayments: number;
};

export async function getVendorStats(): Promise<VendorStats> {
  const [total, active, preferred, openAssignments] = await Promise.all([
    prisma.vendor.count({ where: { deletedAt: null } }),
    prisma.vendor.count({ where: { deletedAt: null, isActive: true } }),
    prisma.vendor.count({ where: { deletedAt: null, isPreferred: true } }),
    prisma.vendorAssignment.aggregate({
      where: {
        status: { in: ["PENDING", "REQUESTED", "CONFIRMED"] },
      },
      _sum: { totalCost: true },
    }),
  ]);

  // pendingPayments = (sum of totalCost for non-cancelled assignments) − (sum of vendor payments)
  const paidAgg = await prisma.vendorPayment.aggregate({
    _sum: { amount: true },
  });
  const owed = openAssignments._sum.totalCost ?? 0;
  const paid = paidAgg._sum.amount ?? 0;
  const pendingPayments = Math.max(0, owed - paid);

  return { total, active, preferred, pendingPayments };
}

export async function getVendorById(id: string) {
  return prisma.vendor.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          trip: {
            select: {
              id: true,
              destination: true,
              startDate: true,
              days: true,
              status: true,
            },
          },
        },
      },
      payments: { orderBy: { paymentDate: "desc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
}

export type VendorDetail = NonNullable<
  Awaited<ReturnType<typeof getVendorById>>
>;
