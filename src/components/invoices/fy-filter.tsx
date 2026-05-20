"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FyFilter({ options }: { options: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        FY
      </span>
      <select
        value={params.get("fy") ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(Array.from(params.entries()));
          if (e.target.value) next.set("fy", e.target.value);
          else next.delete("fy");
          router.push(`/invoices?${next.toString()}`);
        }}
        className="h-9 rounded-full border border-line bg-white px-3 text-xs"
      >
        <option value="">All years</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
