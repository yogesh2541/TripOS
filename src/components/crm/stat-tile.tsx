import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "navy" | "accent" | "success" | "danger";

// Surface + border per tone. `navy` is the one inverted (dark) tile;
// the rest are light tints so a row of tiles is scannable at a glance
// rather than five identical white boxes.
const SURFACE: Record<StatTone, string> = {
  default: "border-line bg-white",
  navy: "border-navy bg-navy text-ivory",
  accent: "border-sand-200 bg-sand-50",
  success: "border-emerald-100 bg-emerald-50/70",
  danger: "border-red-100 bg-red-50/70",
};

const LABEL: Record<StatTone, string> = {
  default: "text-sand-700",
  navy: "text-sand",
  accent: "text-sand-800",
  success: "text-emerald-700",
  danger: "text-red-700",
};

export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: StatTone;
  icon?: React.ReactNode;
}) {
  const inner = (
    <div
      className={cn(
        "h-full rounded-2xl border p-5 transition-all",
        SURFACE[tone],
        href && "hover:shadow-soft hover:-translate-y-0.5 cursor-pointer group"
      )}
    >
      <div className="flex items-center justify-between">
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.22em] flex items-center gap-1.5",
            LABEL[tone]
          )}
        >
          {icon}
          {label}
        </p>
        {href && (
          <ArrowUpRight
            className={cn(
              "h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity",
              tone === "navy" ? "text-ivory" : "text-navy"
            )}
          />
        )}
      </div>
      <p
        className={cn(
          "mt-3 font-display text-4xl tracking-tight",
          tone === "navy" ? "text-ivory" : "text-navy"
        )}
      >
        {value}
      </p>
      {hint && (
        <p
          className={cn(
            "mt-1 text-xs",
            tone === "navy" ? "text-ivory/60" : "text-muted-foreground"
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
