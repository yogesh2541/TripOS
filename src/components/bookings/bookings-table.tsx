"use client";

import { useMemo, useState } from "react";
import type { BookingStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  FilterSearch,
  FilterSelect,
  TableFilters,
} from "@/components/ui/table-filters";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import {
  BOOKING_STATUS_ACCENT,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_ORDER,
  BOOKING_STATUS_TONE,
} from "@/lib/crm";
import { formatDate, formatINR } from "@/lib/utils";

export type BookingRow = {
  id: string;
  tripId: string;
  destination: string;
  leadName: string | null;
  quoteVersion: number;
  status: BookingStatus;
  totalAmount: number;
  paidAmount: number;
  createdAt: Date | string;
  wa: {
    count: number;
    unreadInbound: number;
    lastDirection: "INBOUND" | "OUTBOUND";
  } | null;
};

export function BookingsTable({ bookings }: { bookings: BookingRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookings.filter((b) => {
      if (
        needle &&
        !`${b.destination} ${b.leadName ?? ""}`.toLowerCase().includes(needle)
      )
        return false;
      if (status !== "all" && b.status !== status) return false;
      return true;
    });
  }, [bookings, q, status]);

  const hasFilters = q !== "" || status !== "all";

  const columns: Column<BookingRow>[] = [
    {
      key: "destination",
      header: "Trip",
      sortValue: (r) => r.destination.toLowerCase(),
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-navy truncate">{r.destination}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {r.leadName ?? "Direct"} · Quote v{r.quoteVersion}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge variant={BOOKING_STATUS_TONE[r.status]}>
          {BOOKING_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (r) => r.totalAmount,
      render: (r) => (
        <span className="tabular-nums text-navy">
          {formatINR(r.totalAmount)}
        </span>
      ),
    },
    {
      key: "paid",
      header: "Collected",
      align: "right",
      sortValue: (r) => r.paidAmount,
      className: "hidden sm:block",
      render: (r) => {
        const pct =
          r.totalAmount > 0
            ? Math.round((r.paidAmount / r.totalAmount) * 100)
            : 0;
        return (
          <div className="text-right">
            <span className="tabular-nums text-ink/80">
              {formatINR(r.paidAmount)}
            </span>
            <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      key: "pending",
      header: "Pending",
      align: "right",
      sortValue: (r) => Math.max(0, r.totalAmount - r.paidAmount),
      className: "hidden lg:block",
      render: (r) => {
        const pending = Math.max(0, r.totalAmount - r.paidAmount);
        return (
          <span
            className={
              "tabular-nums " +
              (pending > 0 ? "text-red-700" : "text-emerald-700")
            }
          >
            {pending > 0 ? formatINR(pending) : "Settled"}
          </span>
        );
      },
    },
    {
      key: "created",
      header: "Created",
      sortValue: (r) => new Date(r.createdAt),
      className: "hidden lg:block",
      render: (r) => (
        <span className="text-xs text-ink/70">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "wa",
      header: "WA",
      align: "center",
      render: (r) =>
        r.wa ? (
          <InlineWhatsappBadge
            count={r.wa.count}
            unreadInbound={r.wa.unreadInbound}
            lastDirection={r.wa.lastDirection}
          />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilters
        shown={filtered.length}
        total={bookings.length}
        hasActiveFilters={hasFilters}
        onClear={() => {
          setQ("");
          setStatus("all");
        }}
      >
        <FilterSearch
          value={q}
          onChange={setQ}
          placeholder="Search trip, customer"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All status" },
            ...BOOKING_STATUS_ORDER.map((s) => ({
              value: s,
              label: BOOKING_STATUS_LABEL[s],
            })),
          ]}
        />
      </TableFilters>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/trips/${r.tripId}`}
        gridClassName="grid-cols-[1.8fr_0.9fr_1fr_1fr_1fr_0.9fr_auto]"
        initialSort={{ key: "created", dir: "desc" }}
        rowAccent={(r) => BOOKING_STATUS_ACCENT[r.status]}
        empty={
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-muted-foreground">
            No bookings match these filters.
          </div>
        }
      />
    </div>
  );
}
