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
        "inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        inboundLatest
          ? "border-ok/30 bg-ok-soft text-ok"
          : "border-line bg-paper text-muted",
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
            inboundLatest ? "text-ok" : "text-muted"
          )}
        />
        {unreadInbound > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
        ) : null}
      </span>
      {unreadInbound > 0 ? unreadInbound : count}
    </span>
  );
}
