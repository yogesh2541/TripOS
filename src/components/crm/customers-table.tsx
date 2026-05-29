"use client";

import { useMemo, useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterSearch, TableFilters } from "@/components/ui/table-filters";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import { formatDate, formatINR } from "@/lib/utils";

export type CustomerRow = {
  id: string;
  name: string;
  convertedAt: Date | string | null;
  tripCount: number;
  booked: number;
  paid: number;
  wa: {
    count: number;
    unreadInbound: number;
    lastDirection: "INBOUND" | "OUTBOUND";
  } | null;
};

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(needle));
  }, [customers, q]);

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Customer",
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{r.name}</p>
          {r.convertedAt && (
            <p className="text-[11px] text-muted truncate font-mono tabular-nums">
              Since {formatDate(r.convertedAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "trips",
      header: "Trips",
      align: "right",
      className: "hidden sm:block",
      sortValue: (r) => r.tripCount,
      render: (r) => (
        <span className="font-mono tabular-nums text-ink-2">{r.tripCount}</span>
      ),
    },
    {
      key: "booked",
      header: "Booked",
      align: "right",
      sortValue: (r) => r.booked,
      render: (r) => (
        <span className="font-mono tabular-nums text-ink">{formatINR(r.booked)}</span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      align: "right",
      className: "hidden sm:block",
      sortValue: (r) => r.paid,
      render: (r) => (
        <span className="font-mono tabular-nums text-ink-2">{formatINR(r.paid)}</span>
      ),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      align: "right",
      className: "hidden lg:block",
      sortValue: (r) => Math.max(0, r.booked - r.paid),
      render: (r) => {
        const due = Math.max(0, r.booked - r.paid);
        return (
          <span
            className={
              "font-mono tabular-nums " + (due > 0 ? "text-bad" : "text-ok")
            }
          >
            {due > 0 ? formatINR(due) : "Settled"}
          </span>
        );
      },
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
          <span className="text-muted text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilters
        shown={filtered.length}
        total={customers.length}
        hasActiveFilters={q !== ""}
        onClear={() => setQ("")}
      >
        <FilterSearch
          value={q}
          onChange={setQ}
          placeholder="Search customers"
        />
      </TableFilters>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/contacts/${r.id}`}
        gridClassName="grid-cols-[1.8fr_0.7fr_1fr_1fr_1.1fr_auto]"
        initialSort={{ key: "booked", dir: "desc" }}
        empty={
          <div className="rounded-lg border border-dashed border-line bg-paper-2 p-10 text-center text-sm text-muted">
            No customers match this search.
          </div>
        }
      />
    </div>
  );
}
