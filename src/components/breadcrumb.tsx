"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS, isNavActive } from "@/lib/nav";

// Topbar breadcrumb (muted › bold current). Derives the current section from
// the shared nav definition so it always matches the active sidebar item.
export function Breadcrumb() {
  const pathname = usePathname();

  const items = NAV_GROUPS.flatMap((g) => g.items);
  const current =
    items.find((i) => i.href !== "/" && isNavActive(pathname, i.href)) ??
    items.find((i) => i.href === "/" && pathname === "/");

  const label = current?.label ?? "Dashboard";

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden md:flex items-center gap-2 text-[13px] text-muted-foreground"
    >
      <span>TripCraft</span>
      <ChevronRight className="h-[13px] w-[13px] text-faint" />
      <b className="font-semibold text-ink">{label}</b>
    </nav>
  );
}
