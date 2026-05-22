import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SearchResultType =
  | "contact"
  | "trip"
  | "vendor"
  | "voucher";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  href: string;
  badge: string | null;
};

const PER_TYPE_LIMIT = 6;

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  // Bail on a single character to keep results meaningful and queries cheap
  if (q.length < 2) return [];

  const insensitive: Prisma.QueryMode = "insensitive";

  const [leads, trips, vendors, vouchers] = await Promise.all([
    prisma.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: insensitive } },
          { destination: { contains: q, mode: insensitive } },
          { email: { contains: q, mode: insensitive } },
          { phone: { contains: q, mode: insensitive } },
          { notes: { contains: q, mode: insensitive } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        destination: true,
        status: true,
      },
    }),

    prisma.trip.findMany({
      where: {
        deletedAt: null,
        OR: [
          { destination: { contains: q, mode: insensitive } },
          { notes: { contains: q, mode: insensitive } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        destination: true,
        days: true,
        status: true,
        startDate: true,
        contact: { select: { name: true } },
      },
    }),

    prisma.vendor.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: insensitive } },
          { city: { contains: q, mode: insensitive } },
          { email: { contains: q, mode: insensitive } },
          { phone: { contains: q, mode: insensitive } },
          { notes: { contains: q, mode: insensitive } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: [{ isPreferred: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
      },
    }),

    prisma.voucher.findMany({
      where: {
        OR: [
          { voucherNumber: { contains: q, mode: insensitive } },
          { title: { contains: q, mode: insensitive } },
        ],
      },
      take: PER_TYPE_LIMIT,
      orderBy: { generatedAt: "desc" },
      select: {
        id: true,
        voucherNumber: true,
        title: true,
        shareToken: true,
        sentAt: true,
      },
    }),
  ]);

  const results: SearchResult[] = [
    ...leads.map<SearchResult>((l) => ({
      id: l.id,
      type: "contact",
      title: l.name,
      subtitle: l.destination ?? null,
      href: `/contacts/${l.id}`,
      badge: l.status,
    })),
    ...trips.map<SearchResult>((t) => ({
      id: t.id,
      type: "trip",
      title: t.destination,
      subtitle: [
        `${t.days} ${t.days === 1 ? "day" : "days"}`,
        t.contact?.name,
      ]
        .filter(Boolean)
        .join(" · ") || null,
      href: `/trips/${t.id}`,
      badge: t.status,
    })),
    ...vendors.map<SearchResult>((v) => ({
      id: v.id,
      type: "vendor",
      title: v.name,
      subtitle: [v.type, v.city].filter(Boolean).join(" · ") || null,
      href: `/vendors/${v.id}`,
      badge: null,
    })),
    ...vouchers.map<SearchResult>((vo) => ({
      id: vo.id,
      type: "voucher",
      title: vo.voucherNumber,
      subtitle: vo.title,
      href: `/v/${vo.shareToken}`,
      badge: vo.sentAt ? "SENT" : "DRAFT",
    })),
  ];

  return results;
}
