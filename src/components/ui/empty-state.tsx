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
      ? "rounded-lg border border-dashed border-line bg-paper-2 p-10 text-center"
      : variant === "inline"
        ? "rounded-[10px] border border-dashed border-line bg-paper-2 p-6 text-center"
        : "rounded-lg border border-dashed border-line bg-paper-2 p-12 md:p-16 text-center";

  return (
    <div className={cn(base, className)}>
      {icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-paper text-gold-deep">
          {icon}
        </div>
      ) : null}
      <p
        className={cn(
          "font-display text-ink",
          variant === "inline" ? "text-base" : "text-2xl"
        )}
      >
        {title}
      </p>
      {body ? (
        <p
          className={cn(
            "mt-2 text-muted max-w-md mx-auto",
            variant === "inline" ? "text-xs" : "text-sm"
          )}
        >
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-6 inline-flex">{action}</div> : null}
      {hint ? (
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
