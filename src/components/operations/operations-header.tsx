import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Receipt,
  TrendingUp,
  Wallet,
  FileCheck,
} from "lucide-react";
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE } from "@/lib/crm";
import { formatINR } from "@/lib/utils";
import type { TripOpsSnapshot } from "@/server/services/operations";

export function OperationsHeader({
  snapshot,
}: {
  snapshot: TripOpsSnapshot;
}) {
  const { trip, stats } = snapshot;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Badge variant={TRIP_STATUS_TONE[trip.status]}>
            {TRIP_STATUS_LABEL[trip.status]}
          </Badge>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Operations status
          </p>
        </div>

        <div className="flex-1 min-w-[200px] max-w-md">
          <ProgressBar
            label="Vendor confirmations"
            pct={stats.confirmationProgressPct}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MiniStat
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-700" />}
          label="Confirmed"
          value={`${stats.confirmedCount}`}
          hint={`of ${stats.totalAssignments - stats.cancelledCount}`}
        />
        <MiniStat
          icon={<Clock className="h-4 w-4 text-sand-700" />}
          label="Pending"
          value={`${stats.pendingCount}`}
          hint="Awaiting confirmation"
        />
        <MiniStat
          icon={<Wallet className="h-4 w-4 text-navy" />}
          label="Vendor cost"
          value={formatINR(stats.totalCost)}
          hint="Live assignments"
        />
        <MiniStat
          icon={<Receipt className="h-4 w-4 text-navy" />}
          label="Selling"
          value={formatINR(stats.totalSelling)}
        />
        <MiniStat
          icon={<TrendingUp className="h-4 w-4 text-emerald-700" />}
          label="Gross profit"
          value={formatINR(stats.grossProfit)}
          tone={stats.grossProfit < 0 ? "danger" : "default"}
        />
        <MiniStat
          icon={<FileCheck className="h-4 w-4 text-sand-700" />}
          label="Vouchers"
          value={`${stats.voucherCompletionPct}%`}
          hint="Of confirmed"
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <p
        className={`mt-2 font-display text-2xl tabular-nums ${
          tone === "danger" ? "text-red-700" : "text-navy"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{label}</span>
        <span className="text-navy font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-line/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-sand transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
