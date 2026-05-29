"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Compass,
  Building2,
  FileText,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { globalSearchAction } from "@/server/actions/search";
import type {
  SearchResult,
  SearchResultType,
} from "@/server/services/search";
import { cn } from "@/lib/utils";

const ICON_BY_TYPE: Record<SearchResultType, React.ReactNode> = {
  contact: <Sparkles className="h-3.5 w-3.5" />,
  trip: <Compass className="h-3.5 w-3.5" />,
  vendor: <Building2 className="h-3.5 w-3.5" />,
  voucher: <FileText className="h-3.5 w-3.5" />,
};
const LABEL_BY_TYPE: Record<SearchResultType, string> = {
  contact: "Leads",
  trip: "Trips",
  vendor: "Vendors",
  voucher: "Vouchers",
};
const TYPE_ORDER: SearchResultType[] = ["contact", "trip", "vendor", "voucher"];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Open with Cmd/Ctrl+K (or "/" while not focused on an input).
  // Also opens via the custom "tripos:open-search" window event so other
  // components (e.g. mobile nav) can trigger it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // "/" toggles open if not currently typing in another input
      if (
        e.key === "/" &&
        !isMod &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("tripos:open-search", onOpenEvent as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(
        "tripos:open-search",
        onOpenEvent as EventListener
      );
    };
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      // Focus input after dialog mount paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          const r = await globalSearchAction(q);
          setResults(r);
          setActiveIndex(0);
        } finally {
          setIsLoading(false);
        }
      });
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const grouped = useMemo(() => {
    const groups = new Map<SearchResultType, SearchResult[]>();
    for (const r of results) {
      const arr = groups.get(r.type) ?? [];
      arr.push(r);
      groups.set(r.type, arr);
    }
    // Re-flatten in TYPE_ORDER so keyboard nav goes contact → trip → vendor → voucher
    const flat: SearchResult[] = [];
    for (const t of TYPE_ORDER) {
      for (const r of groups.get(t) ?? []) flat.push(r);
    }
    return { groups, flat };
  }, [results]);

  const navigate = useCallback(
    (r: SearchResult) => {
      router.push(r.href);
      setOpen(false);
    },
    [router]
  );

  // Keyboard navigation in the results list
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (grouped.flat.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(grouped.flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = grouped.flat[activeIndex];
        if (target) navigate(target);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, grouped.flat, activeIndex, navigate]);

  // Scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-active="true"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  return (
    <>
      <SearchTrigger onClick={() => setOpen(true)} />

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="relative w-full max-w-2xl rounded-2xl border border-line bg-white shadow-pop overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3">
              {isLoading ? (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads, trips, vendors, vouchers…"
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-navy text-sm"
              />
              <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-line bg-ivory px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Esc
              </kbd>
            </div>

            <div
              ref={listRef}
              className="max-h-[60vh] overflow-y-auto"
            >
              {query.trim().length < 2 ? (
                <Hint />
              ) : grouped.flat.length === 0 ? (
                isLoading ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Searching…
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-navy">No results</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try a name, destination, vendor, or voucher number.
                    </p>
                  </div>
                )
              ) : (
                <div className="py-2">
                  {TYPE_ORDER.map((type) => {
                    const items = grouped.groups.get(type) ?? [];
                    if (items.length === 0) return null;
                    return (
                      <section key={type}>
                        <header className="px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          {LABEL_BY_TYPE[type]}
                        </header>
                        <ul>
                          {items.map((r) => {
                            const idxInFlat = grouped.flat.indexOf(r);
                            const active = idxInFlat === activeIndex;
                            return (
                              <li key={`${r.type}-${r.id}`}>
                                <button
                                  type="button"
                                  data-active={active ? "true" : "false"}
                                  onMouseEnter={() => setActiveIndex(idxInFlat)}
                                  onClick={() => navigate(r)}
                                  className={cn(
                                    "w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors",
                                    active
                                      ? "bg-sand-50/60"
                                      : "hover:bg-ivory/70"
                                  )}
                                >
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-ivory text-sand-700 shrink-0">
                                    {ICON_BY_TYPE[r.type]}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-navy truncate">
                                      {r.title}
                                    </span>
                                    {r.subtitle ? (
                                      <span className="block text-xs text-muted-foreground truncate">
                                        {r.subtitle}
                                      </span>
                                    ) : null}
                                  </span>
                                  {r.badge ? (
                                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                      {r.badge}
                                    </span>
                                  ) : null}
                                  <ArrowRight
                                    className={cn(
                                      "h-3.5 w-3.5 transition-opacity",
                                      active
                                        ? "text-sand-700 opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-line/70 bg-ivory/50 px-4 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <KbdHint k="↑↓" label="navigate" />
                <KbdHint k="↵" label="open" />
                <KbdHint k="Esc" label="close" />
              </div>
              <span>
                {grouped.flat.length > 0
                  ? `${grouped.flat.length} ${
                      grouped.flat.length === 1 ? "result" : "results"
                    }`
                  : ""}
              </span>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden md:inline-flex h-[34px] min-w-[230px] items-center gap-2 rounded-[9px] border border-line bg-paper px-[11px] text-[12.5px] text-muted-foreground transition-colors hover:border-[var(--gold-line)]"
      aria-label="Open search (Cmd+K)"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search trips, leads, vendors…</span>
      <kbd className="ml-auto inline-flex items-center rounded-[5px] border border-line bg-paper-2 px-1.5 py-px font-mono text-[10px] text-faint">
        ⌘K
      </kbd>
    </button>
  );
}

function Hint() {
  return (
    <div className="px-4 py-8">
      <p className="text-sm font-medium text-navy text-center">
        Find anything fast
      </p>
      <p className="text-xs text-muted-foreground text-center mt-1 max-w-md mx-auto">
        Search by traveler name, destination, vendor, or voucher number.
        Use ↑/↓ to navigate, Enter to open.
      </p>
      <div className="mt-5 grid gap-2 grid-cols-2 max-w-md mx-auto">
        <Suggest icon={<Sparkles className="h-3.5 w-3.5" />} label="Contact names" />
        <Suggest icon={<Compass className="h-3.5 w-3.5" />} label="Destinations" />
        <Suggest icon={<Building2 className="h-3.5 w-3.5" />} label="Vendor names" />
        <Suggest icon={<FileText className="h-3.5 w-3.5" />} label="Voucher numbers" />
      </div>
    </div>
  );
}

function Suggest({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs text-navy">
      <span className="text-sand-700">{icon}</span>
      {label}
    </div>
  );
}

function KbdHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="inline-flex h-4 items-center rounded border border-line bg-white px-1 text-[10px] tracking-wider text-navy">
        {k}
      </kbd>
      {label}
    </span>
  );
}
