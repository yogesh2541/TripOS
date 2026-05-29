"use client";

import { useMemo, useState } from "react";
import type { InvoiceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  FilterSearch,
  FilterSelect,
  TableFilters,
} from "@/components/ui/table-filters";
import { formatDate, formatINR } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  destination: string | null;
  customerName: string | null;
  invoiceFy: string | null;
  grandTotal: number;
  // The date that matters per status: issuedAt / cancelledAt / createdAt.
  effectiveDate: Date | string;
};

const TONE: Record<InvoiceStatus, "outline" | "success" | "danger"> = {
  DRAFT: "outline",
  ISSUED: "success",
  CANCELLED: "danger",
};

const ACCENT: Record<InvoiceStatus, string> = {
  DRAFT: "border-l-gold",
  ISSUED: "border-l-ok",
  CANCELLED: "border-l-bad",
};

export function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (
        needle &&
        !`${inv.invoiceNumber ?? "draft"} ${inv.destination ?? ""} ${
          inv.customerName ?? ""
        }`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      if (status !== "all" && inv.status !== status) return false;
      return true;
    });
  }, [invoices, q, status]);

  const hasFilters = q !== "" || status !== "all";

  const columns: Column<InvoiceRow>[] = [
    {
      key: "number",
      header: "Invoice",
      sortValue: (r) => r.invoiceNumber ?? "zzz-draft",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-mono text-[12px] font-semibold text-ink truncate">
            {r.invoiceNumber ?? <span className="text-muted">Draft</span>}
          </p>
          <p className="t-mut truncate">
            {r.destination ?? "—"}
            {r.customerName ? ` · ${r.customerName}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <Badge variant={TONE[r.status]}>{r.status}</Badge>,
    },
    {
      key: "fy",
      header: "FY",
      sortValue: (r) => r.invoiceFy ?? "",
      className: "hidden sm:block",
      render: (r) => (
        <span className="text-xs text-ink/70">{r.invoiceFy ?? "—"}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      sortValue: (r) => new Date(r.effectiveDate),
      className: "hidden md:block",
      render: (r) => (
        <span className="text-xs text-ink/70">
          {formatDate(r.effectiveDate)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortValue: (r) => r.grandTotal,
      render: (r) => (
        <span className="font-mono tabular-nums font-semibold text-ink">
          {formatINR(r.grandTotal)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilters
        shown={filtered.length}
        total={invoices.length}
        hasActiveFilters={hasFilters}
        onClear={() => {
          setQ("");
          setStatus("all");
        }}
      >
        <FilterSearch
          value={q}
          onChange={setQ}
          placeholder="Search number, customer"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All status" },
            { value: "DRAFT", label: "Draft" },
            { value: "ISSUED", label: "Issued" },
            { value: "CANCELLED", label: "Cancelled" },
          ]}
        />
      </TableFilters>
      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/invoices/${r.id}`}
        gridClassName="grid-cols-[2fr_0.9fr_0.8fr_1fr_1fr]"
        initialSort={{ key: "date", dir: "desc" }}
        rowAccent={(r) => ACCENT[r.status]}
        empty={
          <div className="rounded-lg border border-dashed border-line bg-paper-2 p-10 text-center text-sm text-muted-foreground">
            No invoices match these filters.
          </div>
        }
      />
    </div>
  );
}
