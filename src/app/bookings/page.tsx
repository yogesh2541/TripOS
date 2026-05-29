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
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">
            <Wallet className="h-[13px] w-[13px]" />
            Pipeline · Finance
          </p>
          <h1 className="tc-page-title mt-2.5">Bookings</h1>
          <p className="tc-page-sub">
            {totals._count} active ·{" "}
            <span className="font-mono font-medium text-ink">
              {formatINR(totals._sum.paidAmount ?? 0)}
            </span>
            {" / "}
            <span className="font-mono text-ink">
              {formatINR(totals._sum.totalAmount ?? 0)}
            </span>{" "}
            collected
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-7">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
            className={cn("tc-chip", f.key === filter && "on")}
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
        <div className="rounded-lg border border-dashed border-line bg-paper-2 p-12 text-center">
          <Wallet className="h-6 w-6 mx-auto text-muted mb-3" />
          <p className="font-display text-2xl text-ink">
            No bookings in this filter
          </p>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Accept a quote on a trip to create one — bookings land here
            automatically with payment status, invoice and trip context.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/trips">
              <button className="tc-btn tc-btn-ghost">Browse trips</button>
            </Link>
            {filter !== "all" ? (
              <Link href="/bookings?status=all">
                <button className="tc-btn tc-btn-ghost">
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
                  className="group grid grid-cols-[1.4fr_1fr_1fr_auto] gap-6 items-center rounded-lg border border-line bg-paper p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-[var(--gold-line)] hover:shadow-lift"
                >
                  <div>
                    <p className="font-display text-xl text-ink leading-tight">
                      {b.trip.destination}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      <span className="font-mono tabular-nums">
                        {b.trip.days}
                      </span>{" "}
                      days ·{" "}
                      <span className="font-mono tabular-nums">
                        {b.trip.travelers}
                      </span>{" "}
                      travelers
                      {b.trip.contact && ` · ${b.trip.contact.name}`}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between font-mono text-[11px] text-muted">
                      <span>{formatINR(b.paidAmount)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className={cn(
                        "mt-1.5 tc-meter",
                        pct >= 100 && "sage"
                      )}
                    >
                      <i
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          ...(b.status === "CANCELLED"
                            ? { background: "var(--line)" }
                            : {}),
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-mono font-semibold text-ink tabular-nums">
                      {formatINR(b.totalAmount)}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-faint">
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
                    <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-gold-deep transition-colors" />
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
