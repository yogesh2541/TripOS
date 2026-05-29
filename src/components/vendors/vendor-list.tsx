"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Star,
  Phone,
  Mail,
  MessageCircle,
  Search,
  MapPin,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  VENDOR_TYPE_LABEL,
  VENDOR_TYPE_ORDER,
  vendorContactLine,
} from "@/lib/crm";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  togglePreferredVendorAction,
  toggleVendorActiveAction,
} from "@/server/actions/vendors";
import { cn } from "@/lib/utils";
import type { VendorListItem } from "@/server/services/vendors";

type StatusFilter = "all" | "active" | "inactive" | "preferred";

export function VendorList({ vendors }: { vendors: VendorListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | VendorListItem["type"]>("ALL");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (type !== "ALL" && v.type !== type) return false;
      if (status === "active" && !v.isActive) return false;
      if (status === "inactive" && v.isActive) return false;
      if (status === "preferred" && !v.isPreferred) return false;
      if (q) {
        const hay = [
          v.name,
          v.city ?? "",
          v.email ?? "",
          v.phone ?? "",
          v.country ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, search, type, status]);

  function togglePreferred(v: VendorListItem) {
    startTransition(async () => {
      try {
        await togglePreferredVendorAction(v.id, !v.isPreferred);
        toast.success(v.isPreferred ? "Removed from preferred" : "Marked preferred");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      }
    });
  }

  function toggleActive(v: VendorListItem) {
    startTransition(async () => {
      try {
        await toggleVendorActiveAction(v.id, !v.isActive);
        toast.success(v.isActive ? "Vendor archived" : "Vendor reactivated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city, email…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={type}
            onValueChange={(v) =>
              setType(v as "ALL" | VendorListItem["type"])
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {VENDOR_TYPE_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {VENDOR_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="preferred">Preferred</SelectItem>
              <SelectItem value="inactive">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-paper-2 p-16 text-center">
          <p className="font-display text-xl text-ink">No vendors match</p>
          <p className="mt-2 text-sm text-muted">
            Try a different search or clear the filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v, i) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25 }}
            >
              <VendorRowCard
                v={v}
                onTogglePreferred={() => togglePreferred(v)}
                onToggleActive={() => toggleActive(v)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorRowCard({
  v,
  onTogglePreferred,
  onToggleActive,
}: {
  v: VendorListItem;
  onTogglePreferred: () => void;
  onToggleActive: () => void;
}) {
  const location = vendorContactLine(v);
  return (
    <div
      className={cn(
        "group relative rounded-lg border border-line bg-paper p-5 shadow-soft transition-all",
        "hover:border-[var(--gold-line)] hover:shadow-lift",
        v.isPreferred && "ring-1 ring-[var(--gold-line)] bg-gold-soft/20",
        !v.isActive && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/vendors/${v.id}`}
              className="font-display text-xl text-ink hover:text-gold-deep transition-colors truncate"
            >
              {v.name}
            </Link>
            {v.isPreferred ? (
              <Star className="h-4 w-4 fill-gold-deep text-gold-deep" />
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="muted">{VENDOR_TYPE_LABEL[v.type]}</Badge>
            {!v.isActive ? <Badge variant="danger">Archived</Badge> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <button
            type="button"
            onClick={onTogglePreferred}
            className={cn(
              "rounded-[6px] p-1.5 transition-colors",
              v.isPreferred
                ? "text-gold-deep hover:bg-gold-soft"
                : "text-muted hover:text-gold-deep hover:bg-gold-soft"
            )}
            title={v.isPreferred ? "Remove preferred" : "Mark preferred"}
          >
            <Star className={cn("h-4 w-4", v.isPreferred && "fill-gold-deep")} />
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            className={cn(
              "rounded-[6px] p-1.5 transition-colors text-muted hover:text-ink"
            )}
            title={v.isActive ? "Archive vendor" : "Reactivate vendor"}
          >
            {v.isActive ? (
              <Power className="h-4 w-4" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {location ? (
        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {location}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {v.phone ? (
          <a
            href={`tel:${v.phone}`}
            className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-[11px] text-ink hover:border-[var(--gold-line)]"
          >
            <Phone className="h-3 w-3" />
            {v.phone}
          </a>
        ) : null}
        {v.whatsapp ? (
          <a
            href={`https://wa.me/${v.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-[11px] text-ok hover:border-ok/40"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </a>
        ) : null}
        {v.email ? (
          <a
            href={`mailto:${v.email}`}
            className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-[11px] text-ink hover:border-[var(--gold-line)] truncate max-w-[160px]"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{v.email}</span>
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-3 text-xs text-muted">
        <span>
          {v.assignmentsCount} assignment
          {v.assignmentsCount === 1 ? "" : "s"}
        </span>
        <span className="font-mono tabular-nums">
          ₹ {Math.round(v.paidTotal).toLocaleString("en-IN")} paid
        </span>
      </div>
    </div>
  );
}
