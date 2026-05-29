"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { NAV_GROUPS, isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Desktop left rail — "Atelier Pro": full-height inkwash panel with a warm
// gold edge-glow, gold brand mark, and a gold left-edge bar on the active
// item. Hidden below md ([mobile-nav.tsx](src/components/mobile-nav.tsx)
// covers small screens). Sticky full-height flex child so it stays put while
// the content scrolls.
export function AppSidebar({
  agencyName,
  userName,
}: {
  agencyName: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const initials = (userName ?? agencyName)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside
      className="relative hidden md:flex sticky top-0 h-screen shrink-0 flex-col bg-inkwash text-[var(--on-dark)] print:hidden"
      style={{ width: "var(--side-w)", borderRight: "1px solid rgba(255,255,255,.06)" }}
    >
      {/* warm gold edge glow on the right */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(200,169,106,.25), transparent)",
        }}
      />

      <Link
        href="/"
        className="flex items-center gap-3 px-[18px]"
        style={{
          height: "var(--top-h)",
          borderBottom: "1px solid rgba(255,255,255,.07)",
        }}
      >
        <span
          className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] text-inkwash"
          style={{
            background: "linear-gradient(150deg, var(--gold), #B0863F)",
            boxShadow: "0 2px 8px rgba(200,169,106,.35)",
          }}
        >
          <Compass className="h-[17px] w-[17px]" />
        </span>
        <span className="font-display text-[19px] leading-none tracking-[0.01em] text-white">
          Trip<b className="font-semibold text-gold">Craft</b>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label ?? `g${gi}`}>
            {group.label ? (
              <p className="px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[rgba(157,176,190,.55)]">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-[11px] rounded-[9px] px-2.5 py-2 text-[13px] transition-colors",
                        active
                          ? "bg-white/[0.08] font-medium text-white"
                          : "font-normal text-[var(--on-dark-mut)] hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute -left-3 top-1/2 -translate-y-1/2 rounded-r-[3px] bg-gold"
                          style={{ width: 3, height: 20 }}
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active
                            ? "text-gold"
                            : "text-[rgba(157,176,190,.7)] group-hover:text-[var(--on-dark)]"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className="flex items-center gap-2.5 px-3.5 py-[11px]"
        style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}
      >
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-xs font-semibold text-gold"
          style={{
            background: "linear-gradient(150deg,#2a3b49,#16242f)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          {initials || "TC"}
        </span>
        <div className="min-w-0">
          {userName ? (
            <div className="truncate text-[12.5px] font-medium leading-tight text-white">
              {userName}
            </div>
          ) : null}
          <div className="truncate text-[10.5px] leading-tight text-[var(--on-dark-mut)]">
            {agencyName}
          </div>
        </div>
      </div>
    </aside>
  );
}
