"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Menu, Search, X } from "lucide-react";
import { NAV_GROUPS, isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Portal target only exists client-side.
  useEffect(() => setMounted(true), []);

  // close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll while drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function fireSearch() {
    setOpen(false);
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("tripos:open-search"));
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-paper text-ink-2 hover:border-[var(--gold-line)]"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && mounted
        ? createPortal(
        <div
          className="fixed inset-0 z-[100]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-inkwash/50 backdrop-blur-sm"
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="Menu"
            className="absolute left-0 top-0 h-full w-[82vw] max-w-xs bg-inkwash text-[var(--on-dark)] shadow-lift flex flex-col"
          >
            <header
              className="flex items-center justify-between px-4"
              style={{
                height: "var(--top-h)",
                borderBottom: "1px solid rgba(255,255,255,.07)",
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] text-inkwash"
                  style={{
                    background: "linear-gradient(150deg, var(--gold), #B0863F)",
                  }}
                >
                  <Compass className="h-[17px] w-[17px]" />
                </span>
                <span className="font-display text-lg text-white tracking-tight">
                  Trip<b className="font-semibold text-gold">Craft</b>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--on-dark-mut)] hover:text-white hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <button
              type="button"
              onClick={fireSearch}
              className="m-4 flex items-center gap-2 rounded-[9px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[var(--on-dark-mut)] hover:text-white"
            >
              <Search className="h-4 w-4" />
              Search everything
            </button>

            <nav className="flex-1 px-3 pb-4 overflow-y-auto space-y-4">
              {NAV_GROUPS.map((group, gi) => (
                <div key={group.label ?? `g${gi}`}>
                  {group.label ? (
                    <p className="px-2.5 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-[rgba(157,176,190,.55)]">
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
                              "flex items-center gap-[11px] rounded-[9px] px-2.5 py-2.5 text-[13px] transition-colors",
                              active
                                ? "bg-white/[0.08] text-white font-medium"
                                : "text-[var(--on-dark-mut)] hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                active ? "text-gold" : "text-[rgba(157,176,190,.7)]"
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

            <footer
              className="px-4 py-3 text-[11px] text-[var(--on-dark-mut)]"
              style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}
            >
              TripCraft · Crafted for premium travel
            </footer>
          </aside>
        </div>,
            document.body
          )
        : null}
    </>
  );
}
