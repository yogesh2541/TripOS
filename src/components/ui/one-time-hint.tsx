"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "tripos:hint:";

/**
 * Lightweight inline tip that renders once per browser, then never again
 * after the user dismisses it. Keep copy short; use sparingly.
 */
export function OneTimeHint({
  id,
  title,
  children,
  className,
  variant = "soft",
}: {
  id: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "soft" | "accent";
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + id);
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
  }, [id]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_PREFIX + id, "1");
    } catch {
      // ignore — dismissal won't persist but that's fine
    }
  }

  if (!mounted || dismissed) return null;

  return (
    <aside
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-soft",
        variant === "accent"
          ? "border-[var(--gold-line)] bg-gold-soft/50"
          : "border-line bg-paper",
        className
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border",
          variant === "accent"
            ? "border-[var(--gold-line)] bg-paper text-gold-deep"
            : "border-line bg-paper-2 text-gold-deep"
        )}
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        {title ? (
          <p className="text-sm font-medium text-ink">{title}</p>
        ) : null}
        <div
          className={cn("text-xs text-muted", title ? "mt-0.5" : "")}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-muted hover:text-ink hover:bg-paper-2"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
