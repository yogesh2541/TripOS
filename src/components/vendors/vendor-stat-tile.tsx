import { cn } from "@/lib/utils";

export function VendorStatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "danger" | "success";
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-3xl tracking-tight",
          tone === "default" && "text-navy",
          tone === "accent" && "text-sand-800",
          tone === "danger" && "text-red-700",
          tone === "success" && "text-emerald-700"
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
