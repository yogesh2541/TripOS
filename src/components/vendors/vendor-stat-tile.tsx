import { cn } from "@/lib/utils";

// Compact summary tile (Atelier Pro): white card, uppercase micro-label,
// Playfair value tinted by tone. Used for the dense 4-up summary rows on
// Vendors / Operations.
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
    <div className="rounded-lg border border-line bg-paper px-4 py-[13px] shadow-soft">
      <p className="tc-stat-label">{label}</p>
      <p
        className={cn(
          "tc-stat-val tnum mt-1 !text-2xl",
          tone === "default" && "!text-ink",
          tone === "accent" && "!text-gold-deep",
          tone === "danger" && "!text-bad",
          tone === "success" && "!text-ok"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
