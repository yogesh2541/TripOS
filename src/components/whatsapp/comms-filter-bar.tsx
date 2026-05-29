"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Filter, Loader2 } from "lucide-react";

const STATUSES = [
  { v: "", label: "All status" },
  { v: "QUEUED", label: "Queued" },
  { v: "SENT", label: "Sent" },
  { v: "DELIVERED", label: "Delivered" },
  { v: "READ", label: "Read" },
  { v: "FAILED", label: "Failed" },
];

const DIRECTIONS = [
  { v: "", label: "Both directions" },
  { v: "OUTBOUND", label: "Outgoing" },
  { v: "INBOUND", label: "Incoming" },
];

export function CommsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(Array.from(params.entries()));
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted">
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Filter className="h-3.5 w-3.5" />
        )}
        Filters
      </span>
      <select
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className="rounded-[8px] border border-line bg-paper px-3 py-1.5 text-xs text-ink"
      >
        {STATUSES.map((s) => (
          <option key={s.v} value={s.v}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={params.get("direction") ?? ""}
        onChange={(e) => setParam("direction", e.target.value)}
        className="rounded-[8px] border border-line bg-paper px-3 py-1.5 text-xs text-ink"
      >
        {DIRECTIONS.map((d) => (
          <option key={d.v} value={d.v}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        type="search"
        placeholder="Search phone, message"
        defaultValue={params.get("q") ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("q", (e.target as HTMLInputElement).value);
        }}
        className="rounded-[8px] border border-line bg-paper px-3 py-1.5 text-xs text-ink w-56"
      />
    </div>
  );
}
