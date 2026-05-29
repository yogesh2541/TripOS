import Link from "next/link";
import { Plus, Compass } from "lucide-react";
import type { TripStatus } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { TripCard } from "@/components/trip-card";
import { TripsTable, type TripRow } from "@/components/trips-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewToggle } from "@/components/ui/view-toggle";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { TRIP_STATUS_LABEL } from "@/lib/crm";

export const dynamic = "force-dynamic";

// Ordered the way an agent works a pipeline — earliest stage first.
const STATUS_ORDER: TripStatus[] = [
  "PLANNING",
  "QUOTED",
  "BOOKED",
  "VENDOR_CONFIRMATION_PENDING",
  "PARTIALLY_CONFIRMED",
  "READY_TO_TRAVEL",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export default async function TripsIndexPage({
  searchParams,
}: {
  searchParams: { status?: string; view?: string };
}) {
  const { agencyId } = await requireAgency();
  const view = searchParams.view === "table" ? "table" : "cards";

  const activeStatus = STATUS_ORDER.includes(searchParams.status as TripStatus)
    ? (searchParams.status as TripStatus)
    : null;

  const [trips, grouped] = await Promise.all([
    prisma.trip.findMany({
      where: {
        agencyId,
        deletedAt: null,
        ...(activeStatus ? { status: activeStatus } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { name: true } } },
    }),
    prisma.trip.groupBy({
      by: ["status"],
      where: { agencyId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<TripStatus, number>(
    grouped.map((g) => [g.status, g._count._all])
  );
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

  // Only surface filter chips for stages that actually have trips.
  const filters: { value: TripStatus | null; label: string; count: number }[] =
    [
      { value: null, label: "All", count: total },
      ...STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
        value: s,
        label: TRIP_STATUS_LABEL[s],
        count: counts.get(s) ?? 0,
      })),
    ];

  const tripRows: TripRow[] = trips.map((t) => ({
    id: t.id,
    destination: t.destination,
    contactName: t.contact?.name ?? null,
    status: t.status,
    travelType: t.travelType,
    days: t.days,
    travelers: t.travelers,
    startDate: t.startDate,
    createdAt: t.createdAt,
  }));

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">
            <Compass className="h-[13px] w-[13px]" />
            Pipeline
          </p>
          <h1 className="tc-page-title mt-2.5">Trips</h1>
          <p className="tc-page-sub">
            Every itinerary in flight — from first draft to confirmed departure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 ? (
            <ViewToggle
              defaultValue="cards"
              options={[
                { value: "cards", label: "Cards", icon: "grid" },
                { value: "table", label: "Table", icon: "table" },
              ]}
            />
          ) : null}
          <Link href="/trips/new">
            <Button>
              <Plus className="h-4 w-4" />
              New trip
            </Button>
          </Link>
        </div>
      </header>

      {total > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.value === activeStatus;
            const href = f.value ? `/trips?status=${f.value}` : "/trips";
            return (
              <Link
                key={f.value ?? "all"}
                href={href}
                className={`tc-chip${active ? " on" : ""}`}
              >
                {f.label}
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? "text-gold" : "text-faint"
                  }`}
                >
                  {f.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="Craft your first proposal"
          body="Start with a destination and a few days — we'll generate a luxury itinerary draft you can shape from there."
          action={
            <Link href="/trips/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create new trip
              </Button>
            </Link>
          }
          hint="Tip: convert a Won contact to skip the form"
        />
      ) : trips.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="No trips in this stage"
          body="Nothing here right now. Try another filter to see the rest of your pipeline."
          action={
            <Link href="/trips">
              <Button variant="outline">View all trips</Button>
            </Link>
          }
        />
      ) : view === "table" ? (
        <TripsTable trips={tripRows} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t, i) => (
            <TripCard
              key={t.id}
              index={i}
              id={t.id}
              destination={t.destination}
              days={t.days}
              travelers={t.travelers}
              travelType={t.travelType}
              status={t.status}
              leadName={t.contact?.name ?? null}
              startDate={t.startDate}
              createdAt={t.createdAt}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
