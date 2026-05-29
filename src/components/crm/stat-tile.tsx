import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts";

export type StatTone = "default" | "navy" | "accent" | "success" | "danger";

// Icon-chip tone for the new stat tile. The chip is the colour cue now
// (rather than the whole surface), so a row of tiles stays calm white.
const CHIP: Record<StatTone, string> = {
  default: "tc-stat-ic",
  accent: "tc-stat-ic",
  navy: "tc-stat-ic navy",
  success: "tc-stat-ic sage",
  danger: "tc-stat-ic clay",
};

const SPARK_COLOR: Record<StatTone, string> = {
  default: "var(--gold)",
  accent: "var(--gold)",
  navy: "var(--gold)",
  success: "var(--dv-sage)",
  danger: "var(--dv-clay)",
};

// "Atelier Pro" stat tile: white card, gold-soft (or navy/sage/clay) icon chip,
// uppercase micro-label, Playfair value, and either a delta (mono) or a
// sparkline. Hover lifts. Backwards-compatible with the prior prop set.
export function StatTile({
  label,
  value,
  hint,
  href,
  tone = "default",
  icon,
  delta,
  deltaUp,
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: StatTone;
  icon?: React.ReactNode;
  /** Optional mono delta chip, e.g. "+24%". */
  delta?: string;
  deltaUp?: boolean;
  /** Optional sparkline series. */
  spark?: number[];
}) {
  const inner = (
    <div className={cn("tc-stat h-full", href && "cursor-pointer")}>
      <div className="tc-stat-top">
        {icon ? <span className={CHIP[tone]}>{icon}</span> : <span />}
        {delta != null ? (
          <span className={cn("tc-delta", deltaUp ? "up" : "down")}>
            {deltaUp ? (
              <ArrowUpRight className="h-[11px] w-[11px]" />
            ) : (
              <ArrowDownRight className="h-[11px] w-[11px]" />
            )}
            {delta}
          </span>
        ) : null}
      </div>
      <div className="tc-stat-label">{label}</div>
      <div className="tc-stat-val tnum">{value}</div>
      {spark && spark.length > 1 ? (
        <div className="mt-2.5">
          <Sparkline data={spark} color={SPARK_COLOR[tone]} w={150} h={30} />
        </div>
      ) : hint ? (
        <div className="tc-stat-foot">{hint}</div>
      ) : null}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}
