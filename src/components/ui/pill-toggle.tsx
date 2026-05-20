"use client";

import { cn } from "@/lib/utils";

export type PillOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

export function PillToggle<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-white p-1 shadow-soft",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              active
                ? "bg-navy text-ivory shadow-soft"
                : "text-muted-foreground hover:text-navy hover:bg-ivory"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "tabular-nums rounded-full px-1.5 text-[10px]",
                  active ? "bg-white/20 text-ivory" : "bg-line/70 text-muted-foreground"
                )}
              >
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
