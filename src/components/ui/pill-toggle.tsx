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
        "inline-flex items-center gap-0.5 rounded-[9px] border border-line bg-paper-2 p-[3px]",
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
              "inline-flex items-center gap-1.5 rounded-[7px] font-[550] transition-colors",
              size === "sm" ? "px-3 py-1 text-xs" : "px-[13px] py-1.5 text-[12.5px]",
              active
                ? "bg-paper text-ink shadow-soft"
                : "text-muted hover:text-ink"
            )}
          >
            {opt.label}
            {typeof opt.count === "number" ? (
              <span
                className={cn(
                  "font-mono tabular-nums rounded-full px-1.5 text-[10px]",
                  active ? "bg-gold-soft text-gold-deep" : "bg-line/70 text-muted"
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
