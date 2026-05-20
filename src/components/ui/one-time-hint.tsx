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
        "relative flex items-start gap-3 rounded-2xl border p-4 shadow-soft",
        variant === "accent"
          ? "border-sand-200 bg-sand-50/60"
          : "border-line bg-white",
        className
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          variant === "accent"
            ? "border-sand-300 bg-white text-sand-800"
            : "border-line bg-ivory text-sand-700"
        )}
      >
        <Lightbulb className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        {title ? (
          <p className="text-sm font-medium text-navy">{title}</p>
        ) : null}
        <div
          className={cn(
            "text-xs text-muted-foreground",
            title ? "mt-0.5" : ""
          )}
        >
          {children}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-navy hover:bg-ivory"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
