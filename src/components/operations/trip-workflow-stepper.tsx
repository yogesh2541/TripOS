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
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Trip lifecycle
        </p>
        {nextAction ? (
          <div className="text-right max-w-md">
            <p className="text-sm font-medium text-navy">
              {nextAction.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {nextAction.description}
            </p>
          </div>
        ) : null}
      </div>

      <ol className="mt-4 grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "relative flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors",
              s.current
                ? "border-sand-300 bg-sand-50/60"
                : s.done
                  ? "border-emerald-200/70 bg-emerald-50/40"
                  : "border-line bg-ivory"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums border",
                s.done
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : s.current
                    ? "bg-sand text-white border-sand"
                    : "bg-white text-muted-foreground border-line"
              )}
            >
              {s.done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[11px] font-medium leading-tight",
                  s.current
                    ? "text-sand-900"
                    : s.done
                      ? "text-emerald-900"
                      : "text-navy"
                )}
              >
                {s.label}
              </span>
              <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                {s.hint}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
