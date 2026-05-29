"use client";

import { useMemo, useState } from "react";
import type { TripStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterSearch, TableFilters } from "@/components/ui/table-filters";
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE } from "@/lib/crm";
import { formatDate } from "@/lib/utils";

export type TripRow = {
  id: string;
  destination: string;
  contactName: string | null;
  status: TripStatus;
  travelType: string;
  days: number;
  travelers: number;
  startDate: Date | string | null;
  createdAt: Date | string;
};

export function TripsTable({ trips }: { trips: TripRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return trips;
    return trips.filter((t) =>
      `${t.destination} ${t.contactName ?? ""} ${t.travelType}`
        .toLowerCase()
        .includes(needle)
    );
  }, [trips, q]);

  const columns: Column<TripRow>[] = [
    {
      key: "destination",
      header: "Trip",
      sortValue: (r) => r.destination.toLowerCase(),
      render: (r) => (
        <div className="tc-cell-lead">
          <span className="tc-ava-sm">
            {r.destination.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="t-strong truncate">{r.destination}</p>
            <p className="t-mut truncate">
              {r.contactName ?? "No contact linked"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge variant={TRIP_STATUS_TONE[r.status]}>
          {TRIP_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: "type",
      header: "Style",
      className: "hidden sm:block",
      sortValue: (r) => r.travelType.toLowerCase(),
      render: (r) => <span className="text-ink/80">{r.travelType}</span>,
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      className: "hidden md:block",
      sortValue: (r) => r.days,
      render: (r) => (
        <span className="font-mono tabular-nums text-ink-2">{r.days}</span>
      ),
    },
    {
      key: "travelers",
      header: "Pax",
      align: "right",
      className: "hidden md:block",
      sortValue: (r) => r.travelers,
      render: (r) => (
        <span className="font-mono tabular-nums text-ink-2">{r.travelers}</span>
      ),
    },
    {
      key: "start",
      header: "Start",
      className: "hidden lg:block",
      sortValue: (r) => (r.startDate ? new Date(r.startDate) : null),
      render: (r) => (
        <span className="text-xs text-ink/70">
          {r.startDate ? formatDate(r.startDate) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "hidden lg:block",
      sortValue: (r) => new Date(r.createdAt),
      render: (r) => (
        <span className="text-xs text-ink/70">{formatDate(r.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilters
        shown={filtered.length}
        total={trips.length}
        hasActiveFilters={q !== ""}
        onClear={() => setQ("")}
      >
        <FilterSearch
          value={q}
          onChange={setQ}
          placeholder="Search destination, contact"
        />
      </TableFilters>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/trips/${r.id}`}
        gridClassName="grid-cols-[1.8fr_1fr_0.9fr_0.7fr_0.7fr_1fr_1fr]"
        initialSort={{ key: "created", dir: "desc" }}
        empty={
          <div className="rounded-lg border border-dashed border-line bg-paper-2 p-10 text-center text-sm text-muted-foreground">
            No trips match this search.
          </div>
        }
      />
    </div>
  );
}
