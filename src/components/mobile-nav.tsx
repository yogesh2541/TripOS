"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/customers", label: "Customers" },
  { href: "/trips", label: "Trips" },
  { href: "/bookings", label: "Bookings" },
  { href: "/invoices", label: "Invoices" },
  { href: "/vendors", label: "Vendors" },
  { href: "/operations", label: "Operations" },
  { href: "/communications", label: "Communications" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/settings/agency", label: "Settings" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-navy hover:border-sand-200"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
            aria-hidden
          />
          <aside
            role="dialog"
            aria-label="Menu"
            className="absolute right-0 top-0 h-full w-[80vw] max-w-sm bg-ivory shadow-lift flex flex-col"
          >
            <header className="flex items-center justify-between px-4 py-4 border-b border-line/70">
              <span className="font-display text-lg text-navy tracking-tight">
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-navy hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <button
              type="button"
              onClick={fireSearch}
              className="m-4 flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm text-muted-foreground hover:border-sand-200 hover:text-navy"
            >
              <Search className="h-4 w-4" />
              Search everything
            </button>

            <nav className="flex-1 px-2 py-2 overflow-y-auto">
              <ul className="space-y-0.5">
                {LINKS.map((l) => {
                  const active =
                    pathname === l.href ||
                    (l.href !== "/" && pathname?.startsWith(l.href));
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-colors",
                          active
                            ? "bg-sand-50/60 text-navy font-medium"
                            : "text-navy hover:bg-white"
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <footer className="border-t border-line/70 px-4 py-3 text-[11px] text-muted-foreground">
              TripCraft · Crafted for premium travel
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
