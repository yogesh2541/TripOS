import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripWorkflow } from "@/server/services/trip-workflow";

export function TripWorkflowStepper({
  workflow,
}: {
  workflow: TripWorkflow;
}) {
  const { steps, nextAction } = workflow;

  return (
    <section className="rounded-lg border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="tc-eyebrow">Trip lifecycle</p>
        {nextAction ? (
          <div className="text-right max-w-md">
            <p className="text-sm font-medium text-ink">{nextAction.label}</p>
            <p className="text-xs text-muted">{nextAction.description}</p>
          </div>
        ) : null}
      </div>

      <ol className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "relative flex items-start gap-2 rounded-[10px] border px-2.5 py-2 transition-colors",
              s.current
                ? "border-[var(--gold-line)] bg-gold-soft/50"
                : s.done
                  ? "border-ok/30 bg-ok-soft/50"
                  : "border-line bg-paper-2"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] font-mono text-[10px] font-semibold tabular-nums border",
                s.done
                  ? "border-inkwash bg-inkwash text-gold"
                  : s.current
                    ? "border-gold bg-gold text-inkwash"
                    : "border-line bg-paper text-faint"
              )}
            >
              {s.done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[11px] font-medium leading-tight",
                  s.current
                    ? "text-gold-deep"
                    : s.done
                      ? "text-[#3c6b48]"
                      : "text-ink"
                )}
              >
                {s.label}
              </span>
              <span className="block text-[10px] text-muted leading-tight mt-0.5 truncate">
                {s.hint}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
