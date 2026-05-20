import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact inline badge for list rows. Renders nothing when count is zero.
// Pulsing emerald dot when there are unread inbound replies — the operator's
// hottest signal.
//
// Props are pre-computed by the parent page so list rendering stays O(1) per
// row (no per-row DB calls). See getWhatsappStatsForEntities() for the bulk
// aggregator.
export function InlineWhatsappBadge({
  count,
  unreadInbound,
  lastDirection,
  className,
}: {
  count: number;
  unreadInbound: number;
  lastDirection?: "INBOUND" | "OUTBOUND" | null;
  className?: string;
}) {
  if (count === 0) return null;
  const inboundLatest = lastDirection === "INBOUND" || unreadInbound > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        inboundLatest
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-line bg-white text-muted-foreground",
        className
      )}
      title={
        unreadInbound > 0
          ? `${unreadInbound} unread reply${unreadInbound === 1 ? "" : "s"}`
          : `${count} message${count === 1 ? "" : "s"}`
      }
    >
      <span className="relative inline-flex h-3 w-3 items-center justify-center">
        <MessageCircle
          className={cn(
            "h-3 w-3",
            inboundLatest ? "text-emerald-600" : "text-muted-foreground"
          )}
        />
        {unreadInbound > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        ) : null}
      </span>
      {unreadInbound > 0 ? unreadInbound : count}
    </span>
  );
}
