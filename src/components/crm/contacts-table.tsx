"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserCog, X } from "lucide-react";
import { toast } from "sonner";
import type { LeadSource, LeadStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import {
  FilterSearch,
  FilterSelect,
  TableFilters,
} from "@/components/ui/table-filters";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_ACCENT,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_ORDER,
  LEAD_STATUS_TONE,
} from "@/lib/crm";
import { bulkUpdateLeadsAction } from "@/server/actions/contacts";
import { formatDate, formatINR } from "@/lib/utils";

export type LeadRow = {
  id: string;
  name: string;
  destination: string | null;
  source: LeadSource;
  status: LeadStatus;
  budget: number | null;
  adults: number;
  travelStartDate: Date | string | null;
  nextFollowUpAt: Date | string | null;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: Date | string;
  wa: {
    count: number;
    unreadInbound: number;
    lastDirection: "INBOUND" | "OUTBOUND";
  } | null;
};

type Member = { id: string; name: string };

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  return v instanceof Date ? v : new Date(v);
}

const SOURCE_OPTIONS: LeadSource[] = [
  "MANUAL",
  "INSTAGRAM",
  "REFERRAL",
  "WEBSITE",
  "WHATSAPP",
  "GOOGLE",
  "OTHER",
];

export function LeadsTable({
  leads,
  members,
  canEdit,
}: {
  leads: LeadRow[];
  members: Member[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // --- filters ---
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [owner, setOwner] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (
        needle &&
        !`${l.name} ${l.destination ?? ""}`.toLowerCase().includes(needle)
      )
        return false;
      if (status !== "all" && l.status !== status) return false;
      if (source !== "all" && l.source !== source) return false;
      if (owner === "unassigned" && l.ownerId) return false;
      if (owner !== "all" && owner !== "unassigned" && l.ownerId !== owner)
        return false;
      return true;
    });
  }, [leads, q, status, source, owner]);

  const hasFilters =
    q !== "" || status !== "all" || source !== "all" || owner !== "all";
  function clearFilters() {
    setQ("");
    setStatus("all");
    setSource("all");
    setOwner("all");
  }

  // --- selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filteredIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  // Keep selection in sync with what's visible — drop ids filtered out.
  const visibleSelected = useMemo(
    () => new Set(filteredIds.filter((id) => selected.has(id))),
    [filteredIds, selected]
  );

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      const allShown = filteredIds.every((id) => s.has(id));
      const next = new Set(s);
      if (allShown) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function clearSelection() {
    setSelected(new Set());
  }

  // --- bulk operations ---
  function runBulk(
    op:
      | { kind: "status"; status: LeadStatus }
      | { kind: "assign"; ownerId: string | null }
      | { kind: "delete" }
  ) {
    const ids = Array.from(visibleSelected);
    if (ids.length === 0) return;
    if (op.kind === "delete" && !confirm(`Delete ${ids.length} contact(s)?`))
      return;
    startTransition(async () => {
      const res = await bulkUpdateLeadsAction({ ids, op });
      if (res.ok) {
        toast.success(`Updated ${res.count} contact${res.count === 1 ? "" : "s"}`);
        clearSelection();
        router.refresh();
      } else {
        toast.error(res.error || "Bulk update failed");
      }
    });
  }

  const selectedCount = visibleSelected.size;

  const columns: Column<LeadRow>[] = [
    {
      key: "name",
      header: "Contact",
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-navy truncate">{r.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {LEAD_SOURCE_LABEL[r.source]}
          </p>
        </div>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      sortValue: (r) => r.destination?.toLowerCase() ?? "",
      className: "hidden md:block",
      render: (r) => (
        <span className="text-ink/80 truncate block">
          {r.destination ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <Badge variant={LEAD_STATUS_TONE[r.status]}>
          {LEAD_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      sortValue: (r) => r.ownerName?.toLowerCase() ?? "",
      className: "hidden lg:block",
      render: (r) => (
        <span className="text-ink/70 text-xs truncate block">
          {r.ownerName ?? "Unassigned"}
        </span>
      ),
    },
    {
      key: "budget",
      header: "Budget",
      align: "right",
      sortValue: (r) => r.budget ?? 0,
      className: "hidden sm:block",
      render: (r) =>
        r.budget ? (
          <span className="tabular-nums text-navy">{formatINR(r.budget)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "travel",
      header: "Travel",
      sortValue: (r) => toDate(r.travelStartDate),
      className: "hidden lg:block",
      render: (r) =>
        r.travelStartDate ? (
          <span className="text-xs text-ink/70">
            {formatDate(r.travelStartDate)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: "followUp",
      header: "Follow-up",
      sortValue: (r) => toDate(r.nextFollowUpAt),
      render: (r) => {
        const d = toDate(r.nextFollowUpAt);
        if (!d)
          return <span className="text-muted-foreground text-xs">—</span>;
        const overdue = d < new Date();
        return (
          <span
            className={
              "text-xs " +
              (overdue ? "text-red-700 font-medium" : "text-ink/70")
            }
          >
            {formatDate(d)}
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
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilters
        shown={filtered.length}
        total={leads.length}
        hasActiveFilters={hasFilters}
        onClear={clearFilters}
      >
        <FilterSearch
          value={q}
          onChange={setQ}
          placeholder="Search name, destination"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All status" },
            ...LEAD_STATUS_ORDER.map((s) => ({
              value: s,
              label: LEAD_STATUS_LABEL[s],
            })),
          ]}
        />
        <FilterSelect
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "All sources" },
            ...SOURCE_OPTIONS.map((s) => ({
              value: s,
              label: LEAD_SOURCE_LABEL[s],
            })),
          ]}
        />
        <FilterSelect
          value={owner}
          onChange={setOwner}
          options={[
            { value: "all", label: "Any owner" },
            { value: "unassigned", label: "Unassigned" },
            ...members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      </TableFilters>

      {/* Bulk action bar — appears when rows are selected */}
      {canEdit && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-navy bg-navy px-4 py-2.5 text-ivory">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <span className="text-ivory/40">·</span>

          <select
            disabled={isPending}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) runBulk({ kind: "status", status: v as LeadStatus });
            }}
            className="h-8 rounded-lg border border-ivory/25 bg-navy-600 px-2 text-xs text-ivory"
          >
            <option value="">Set status…</option>
            {LEAD_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <select
            disabled={isPending}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v)
                runBulk({
                  kind: "assign",
                  ownerId: v === "__unassign__" ? null : v,
                });
            }}
            className="h-8 rounded-lg border border-ivory/25 bg-navy-600 px-2 text-xs text-ivory"
          >
            <option value="">Assign owner…</option>
            <option value="__unassign__">Unassign</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-ivory hover:bg-navy-600"
            onClick={() => runBulk({ kind: "delete" })}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </Button>

          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-xs text-ivory/70 hover:text-ivory"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      ) : null}

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/contacts/${r.id}`}
        gridClassName="grid-cols-[1.6fr_1.1fr_0.9fr_0.9fr_0.8fr_0.8fr_0.9fr_auto]"
        initialSort={{ key: "followUp", dir: "asc" }}
        rowAccent={(r) => LEAD_STATUS_ACCENT[r.status]}
        selectable={canEdit}
        selectedIds={visibleSelected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        empty={
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center text-sm text-muted-foreground">
            <UserCog className="h-5 w-5 mx-auto mb-2 opacity-60" />
            No contacts match these filters.
          </div>
        }
      />
    </div>
  );
}
