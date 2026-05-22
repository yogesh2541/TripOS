import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";
import type { BookingStatus } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { ViewToggle } from "@/components/ui/view-toggle";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import { BookingsTable, type BookingRow } from "@/components/bookings/bookings-table";
import { getWhatsappStatsForEntities } from "@/server/services/whatsapp";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  BOOKING_STATUS_TONE,
} from "@/lib/crm";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  ...BOOKING_STATUS_ORDER.map((s) => ({
    key: s.toLowerCase(),
    label: BOOKING_STATUS_LABEL[s],
  })),
];

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { status?: string; view?: string };
}) {
  const { agencyId } = await requireAgency();
  const filter = (searchParams.status ?? "active").toLowerCase();
  const view = searchParams.view === "table" ? "table" : "cards";

  let where: Parameters<typeof prisma.booking.findMany>[0] extends infer T
    ? T extends { where?: infer W }
      ? W
      : never
    : never = { trip: { agencyId, deletedAt: null } };

  if (filter === "active") {
    where = { ...where, status: { not: "CANCELLED" } };
  } else if (filter !== "all") {
    const status = filter.toUpperCase() as BookingStatus;
    if (BOOKING_STATUS_ORDER.includes(status)) {
      where = { ...where, status };
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      trip: {
        select: {
          id: true,
          destination: true,
          days: true,
          travelers: true,
          startDate: true,
          contact: { select: { id: true, name: true } },
        },
      },
      quote: { select: { version: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const totals = await prisma.booking.aggregate({
    where: { trip: { agencyId }, status: { not: "CANCELLED" } },
    _sum: { totalAmount: true, paidAmount: true },
    _count: true,
  });

  const waStats = await getWhatsappStatsForEntities({
    agencyId,
    scope: "tripId",
    ids: bookings.map((b) => b.trip.id),
  });

  const waFor = (tripId: string) => {
    const w = waStats.get(tripId);
    return w
      ? {
          count: w.count,
          unreadInbound: w.unreadInbound,
          lastDirection: w.lastDirection,
        }
      : null;
  };

  const tableRows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    tripId: b.trip.id,
    destination: b.trip.destination,
    leadName: b.trip.contact?.name ?? null,
    quoteVersion: b.quote.version,
    status: b.status,
    totalAmount: b.totalAmount,
    paidAmount: b.paidAmount,
    createdAt: b.createdAt,
    wa: waFor(b.trip.id),
  }));

  // Preserve the active view when switching status filters.
  const filterHref = (key: string) => {
    const parts: string[] = [];
    if (key !== "active") parts.push(`status=${key}`);
    if (view === "table") parts.push("view=table");
    return parts.length ? `/bookings?${parts.join("&")}` : "/bookings";
  };

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Pipeline
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Bookings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totals._count} active ·{" "}
            <span className="font-medium text-navy">
              {formatINR(totals._sum.paidAmount ?? 0)}
            </span>
            {" / "}
            <span className="text-navy">
              {formatINR(totals._sum.totalAmount ?? 0)}
            </span>{" "}
            collected
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
            className={cn(
              "h-9 px-4 inline-flex items-center rounded-full border text-xs uppercase tracking-[0.16em] transition-colors",
              f.key === filter
                ? "border-navy bg-navy text-ivory"
                : "border-line bg-white text-navy hover:border-sand"
            )}
          >
            {f.label}
          </Link>
        ))}
        {bookings.length > 0 ? (
          <div className="ml-auto">
            <ViewToggle
              defaultValue="cards"
              options={[
                { value: "cards", label: "Cards", icon: "grid" },
                { value: "table", label: "Table", icon: "table" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-white/60 p-12 text-center">
          <Wallet className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
          <p className="font-display text-2xl text-navy">
            No bookings in this filter
          </p>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Accept a quote on a trip to create one — bookings land here
            automatically with payment status, invoice and trip context.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/trips">
              <button className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-white px-5 py-2 text-sm hover:border-sand">
                Browse trips
              </button>
            </Link>
            {filter !== "all" ? (
              <Link href="/bookings?status=all">
                <button className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-white px-5 py-2 text-sm hover:border-sand">
                  See all statuses
                </button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : view === "table" ? (
        <BookingsTable bookings={tableRows} />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const pct =
              b.totalAmount > 0
                ? Math.round((b.paidAmount / b.totalAmount) * 100)
                : 0;
            return (
              <li key={b.id}>
                <Link
                  href={`/trips/${b.trip.id}`}
                  className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-6 items-center rounded-2xl border border-line bg-white p-5 hover:shadow-soft transition-all group"
                >
                  <div>
                    <p className="font-display text-xl text-navy leading-tight">
                      {b.trip.destination}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.trip.days} days · {b.trip.travelers} travelers
                      {b.trip.contact && ` · ${b.trip.contact.name}`}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <span>{formatINR(b.paidAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-ivory rounded-full overflow-hidden border border-line/60">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          b.status === "CANCELLED"
                            ? "bg-line"
                            : pct >= 100
                              ? "bg-emerald-500"
                              : "bg-navy"
                        )}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-medium text-navy tabular-nums">
                      {formatINR(b.totalAmount)}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Quote v{b.quote.version} · {formatDate(b.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {(() => {
                      const w = waStats.get(b.trip.id);
                      return w ? (
                        <InlineWhatsappBadge
                          count={w.count}
                          unreadInbound={w.unreadInbound}
                          lastDirection={w.lastDirection}
                        />
                      ) : null;
                    })()}
                    <Badge variant={BOOKING_STATUS_TONE[b.status]}>
                      {BOOKING_STATUS_LABEL[b.status]}
                    </Badge>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-navy transition-colors" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
