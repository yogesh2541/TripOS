import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  FileText,
  Flag,
  Handshake,
  PlaneTakeoff,
  RefreshCw,
  Send,
  Sparkles,
  StickyNote,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityType } from "@prisma/client";
import type { TimelineEntry } from "@/server/services/operations";
import { cn } from "@/lib/utils";

const ICONS: Partial<Record<ActivityType, React.ReactNode>> = {
  VENDOR_ASSIGNED: <Handshake className="h-3.5 w-3.5" />,
  VENDOR_CONFIRMED: <CheckCircle2 className="h-3.5 w-3.5" />,
  VENDOR_CANCELLED: <X className="h-3.5 w-3.5" />,
  VOUCHER_GENERATED: <FileText className="h-3.5 w-3.5" />,
  VOUCHER_SENT: <Send className="h-3.5 w-3.5" />,
  VENDOR_PAYMENT_ADDED: <CircleDollarSign className="h-3.5 w-3.5" />,
  OPS_TASK_CREATED: <ClipboardList className="h-3.5 w-3.5" />,
  OPS_TASK_COMPLETED: <ClipboardCheck className="h-3.5 w-3.5" />,
  TRIP_READY: <Flag className="h-3.5 w-3.5" />,
  TRIP_STARTED: <PlaneTakeoff className="h-3.5 w-3.5" />,
  TRIP_COMPLETED: <Trophy className="h-3.5 w-3.5" />,
  STATUS_CHANGED: <RefreshCw className="h-3.5 w-3.5" />,
  PAYMENT_RECORDED: <Wallet className="h-3.5 w-3.5" />,
  BOOKING_CREATED: <FileCheck className="h-3.5 w-3.5" />,
  CUSTOM: <Sparkles className="h-3.5 w-3.5" />,
  NOTE: <StickyNote className="h-3.5 w-3.5" />,
};

const TONES: Partial<Record<ActivityType, string>> = {
  VENDOR_CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  VENDOR_CANCELLED: "border-red-200 bg-red-50 text-red-700",
  TRIP_READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  TRIP_STARTED: "border-sand-200 bg-sand-50 text-sand-800",
  TRIP_COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  VOUCHER_SENT: "border-sand-200 bg-sand-50 text-sand-800",
  PAYMENT_RECORDED: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function OperationsTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <header className="mb-4">
        <h3 className="font-display text-xl text-navy">Operations timeline</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Operational events for this trip — assignments, vouchers, status
          changes.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line/70 bg-ivory p-6 text-center">
          <p className="text-sm font-medium text-navy">Quiet for now</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Vendor confirmations, voucher generation, and trip events will
            stream into this timeline as they happen.
          </p>
        </div>
      ) : (
        <ol className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border shrink-0",
                  TONES[e.type] ?? "border-line bg-ivory text-sand-700"
                )}
              >
                {ICONS[e.type] ?? <Sparkles className="h-3.5 w-3.5" />}
              </span>
              <div className="flex-1 min-w-0 pb-3 border-b border-line/70 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-navy truncate">
                    {e.title}
                  </p>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(e.createdAt, { addSuffix: true })}
                  </span>
                </div>
                {e.body ? (
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                    {e.body}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
