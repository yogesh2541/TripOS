import { cn } from "@/lib/utils";

type Variant = "soft" | "card" | "inline";

export function EmptyState({
  icon,
  title,
  body,
  action,
  hint,
  variant = "soft",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const base =
    variant === "card"
      ? "rounded-2xl border border-dashed border-line bg-white/60 p-10 text-center"
      : variant === "inline"
        ? "rounded-xl border border-dashed border-line/70 bg-ivory p-6 text-center"
        : "rounded-3xl border border-dashed border-line bg-white/60 p-12 md:p-16 text-center";

  return (
    <div className={cn(base, className)}>
      {icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-ivory text-sand-700">
          {icon}
        </div>
      ) : null}
      <p
        className={cn(
          "font-display text-navy",
          variant === "inline" ? "text-base" : "text-2xl"
        )}
      >
        {title}
      </p>
      {body ? (
        <p
          className={cn(
            "mt-2 text-muted-foreground max-w-md mx-auto",
            variant === "inline" ? "text-xs" : "text-sm"
          )}
        >
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6 inline-flex">{action}</div> : null}
      {hint ? (
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
