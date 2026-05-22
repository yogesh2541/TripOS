// Agency analytics — the numbers an owner buys a CRM to see. One service,
// computed from a handful of scoped queries, aggregated in JS. Every query
// is fenced by agencyId; nothing here mutates.

import type { LeadSource, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listAgencyMembers } from "@/lib/session";

export type AnalyticsRange = "30d" | "90d" | "365d" | "all";

const RANGE_DAYS: Record<AnalyticsRange, number | null> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: null,
};

export const RANGE_LABEL: Record<AnalyticsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "365d": "Last 12 months",
  all: "All time",
};

export function parseRange(v: string | undefined): AnalyticsRange {
  return v === "30d" || v === "90d" || v === "365d" || v === "all" ? v : "90d";
}

// Pipeline ordering — a contact's current status is the furthest stage it has
// reached. LOST is unrankable, counted on its own.
const STAGE_RANK: Record<LeadStatus, number> = {
  NEW: 0,
  CONTACTED: 1,
  REQUIREMENT_UNDERSTOOD: 2,
  QUOTED: 3,
  FOLLOW_UP: 3,
  WON: 4,
  LOST: -1,
};

export type Funnel = {
  total: number;
  contacted: number;
  quoted: number;
  won: number;
  lost: number;
  winRate: number; // won / total, %
  quoteRate: number; // quoted / total, %
};

export type RevenueBlock = {
  bookingCount: number;
  booked: number; // sum of booking total (selling)
  collected: number; // sum of paid
  outstanding: number;
  grossProfit: number; // sum of quote profit
  marginPct: number; // grossProfit / selling, %
  avgTripValue: number;
  byMonth: { month: string; label: string; booked: number; collected: number }[];
};

export type AgentRow = {
  userId: string;
  name: string;
  leads: number;
  won: number;
  trips: number;
  revenue: number;
};

export type SourceRow = {
  source: LeadSource;
  leads: number;
  won: number;
  revenue: number;
  conversion: number; // won / leads, %
};

export type Analytics = {
  range: AnalyticsRange;
  funnel: Funnel;
  leadsByStatus: { status: LeadStatus; count: number }[];
  revenue: RevenueBlock;
  agents: AgentRow[];
  sources: SourceRow[];
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

const STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "REQUIREMENT_UNDERSTOOD",
  "QUOTED",
  "FOLLOW_UP",
  "WON",
  "LOST",
];

const SOURCE_ORDER: LeadSource[] = [
  "WEBSITE",
  "INSTAGRAM",
  "WHATSAPP",
  "GOOGLE",
  "REFERRAL",
  "MANUAL",
  "OTHER",
];

export async function getAnalytics(
  agencyId: string,
  range: AnalyticsRange
): Promise<Analytics> {
  const days = RANGE_DAYS[range];
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    : null;
  const createdFilter = since ? { gte: since } : undefined;

  const [leads, bookings, tripsByOwner, members] = await Promise.all([
    prisma.contact.findMany({
      where: {
        agencyId,
        deletedAt: null,
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      select: { status: true, source: true, ownerId: true },
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
        trip: { agencyId, deletedAt: null },
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      select: {
        totalAmount: true,
        paidAmount: true,
        createdAt: true,
        trip: {
          select: { ownerId: true, contact: { select: { source: true } } },
        },
        quote: { select: { profit: true, sellingPrice: true } },
      },
    }),
    prisma.trip.groupBy({
      by: ["ownerId"],
      where: {
        agencyId,
        deletedAt: null,
        ...(createdFilter ? { createdAt: createdFilter } : {}),
      },
      _count: { _all: true },
    }),
    listAgencyMembers(agencyId),
  ]);

  // --- Funnel + status breakdown -------------------------------------------
  const statusCount = new Map<LeadStatus, number>();
  let contacted = 0;
  let quoted = 0;
  let won = 0;
  let lost = 0;
  for (const l of leads) {
    statusCount.set(l.status, (statusCount.get(l.status) ?? 0) + 1);
    const rank = STAGE_RANK[l.status];
    if (l.status === "LOST") lost++;
    if (rank >= 1) contacted++;
    if (rank >= 3) quoted++;
    if (rank >= 4) won++;
  }
  const total = leads.length;
  const funnel: Funnel = {
    total,
    contacted,
    quoted,
    won,
    lost,
    winRate: pct(won, total),
    quoteRate: pct(quoted, total),
  };
  const leadsByStatus = STATUS_ORDER.map((status) => ({
    status,
    count: statusCount.get(status) ?? 0,
  })).filter((s) => s.count > 0);

  // --- Revenue --------------------------------------------------------------
  let booked = 0;
  let collected = 0;
  let grossProfit = 0;
  let sumSelling = 0;
  const monthBuckets = new Map<string, { booked: number; collected: number }>();
  for (const b of bookings) {
    booked += b.totalAmount;
    collected += b.paidAmount;
    grossProfit += b.quote?.profit ?? 0;
    sumSelling += b.quote?.sellingPrice ?? b.totalAmount;
    const key = `${b.createdAt.getFullYear()}-${String(
      b.createdAt.getMonth() + 1
    ).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key) ?? { booked: 0, collected: 0 };
    bucket.booked += b.totalAmount;
    bucket.collected += b.paidAmount;
    monthBuckets.set(key, bucket);
  }
  const byMonth = [...monthBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => {
      const [y, m] = month.split("-").map(Number);
      return {
        month,
        label: new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        }),
        booked: v.booked,
        collected: v.collected,
      };
    });
  const revenue: RevenueBlock = {
    bookingCount: bookings.length,
    booked,
    collected,
    outstanding: Math.max(0, booked - collected),
    grossProfit,
    marginPct: pct(grossProfit, sumSelling),
    avgTripValue: bookings.length > 0 ? Math.round(booked / bookings.length) : 0,
    byMonth,
  };

  // --- Agent performance ----------------------------------------------------
  const agentMap = new Map<string, AgentRow>();
  for (const m of members) {
    agentMap.set(m.id, {
      userId: m.id,
      name: m.name,
      leads: 0,
      won: 0,
      trips: 0,
      revenue: 0,
    });
  }
  const ensureAgent = (id: string | null): AgentRow | null => {
    if (!id) return null;
    let row = agentMap.get(id);
    if (!row) {
      row = { userId: id, name: "Former member", leads: 0, won: 0, trips: 0, revenue: 0 };
      agentMap.set(id, row);
    }
    return row;
  };
  for (const l of leads) {
    const row = ensureAgent(l.ownerId);
    if (!row) continue;
    row.leads++;
    if (l.status === "WON") row.won++;
  }
  for (const t of tripsByOwner) {
    const row = ensureAgent(t.ownerId);
    if (row) row.trips += t._count._all;
  }
  for (const b of bookings) {
    const row = ensureAgent(b.trip.ownerId);
    if (row) row.revenue += b.totalAmount;
  }
  const agents = [...agentMap.values()]
    .filter((a) => a.leads > 0 || a.trips > 0 || a.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.won - a.won);

  // --- Source attribution ---------------------------------------------------
  const sourceMap = new Map<
    LeadSource,
    { leads: number; won: number; revenue: number }
  >();
  const ensureSource = (s: LeadSource) => {
    let row = sourceMap.get(s);
    if (!row) {
      row = { leads: 0, won: 0, revenue: 0 };
      sourceMap.set(s, row);
    }
    return row;
  };
  for (const l of leads) {
    const row = ensureSource(l.source);
    row.leads++;
    if (l.status === "WON") row.won++;
  }
  for (const b of bookings) {
    const src = b.trip.contact?.source;
    if (src) ensureSource(src).revenue += b.totalAmount;
  }
  const sources: SourceRow[] = SOURCE_ORDER.map((source) => {
    const row = sourceMap.get(source);
    return {
      source,
      leads: row?.leads ?? 0,
      won: row?.won ?? 0,
      revenue: row?.revenue ?? 0,
      conversion: pct(row?.won ?? 0, row?.leads ?? 0),
    };
  }).filter((s) => s.leads > 0 || s.revenue > 0);

  return { range, funnel, leadsByStatus, revenue, agents, sources };
}
