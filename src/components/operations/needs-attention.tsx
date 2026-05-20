import Link from "next/link";
import {
  AlertTriangle,
  PlaneTakeoff,
  Hotel,
  Wallet,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { DashboardSnapshot } from "@/server/services/operations-dashboard";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  tone: "urgent" | "warn" | "info";
  icon: React.ReactNode;
  label: string;
  href?: string;
};

export function NeedsAttention({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const items: Item[] = [];

  // 1) Trips ready to mark in progress / complete (highest urgency — time-bound)
  for (const t of snapshot.shouldStartToday.slice(0, 2)) {
    items.push({
      id: `start-${t.tripId}`,
      tone: "urgent",
      icon: <PlaneTakeoff className="h-3.5 w-3.5" />,
      label: `${t.destination} departs today — mark in progress`,
      href: `/trips/${t.tripId}`,
    });
  }
  for (const t of snapshot.shouldComplete.slice(0, 2)) {
    items.push({
      id: `complete-${t.tripId}`,
      tone: "warn",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: `${t.destination} ended — close it out`,
      href: `/trips/${t.tripId}`,
    });
  }

  // 2) Overdue ops tasks (high)
  if (snapshot.overdueTasks.length > 0) {
    items.push({
      id: "overdue",
      tone: "urgent",
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: `${snapshot.overdueTasks.length} overdue ${
        snapshot.overdueTasks.length === 1 ? "task" : "tasks"
      }`,
    });
  }

  // 3) Pending vendor confirmations on trips departing soon
  if (snapshot.stats.awaitingConfirmation > 0) {
    items.push({
      id: "pending-confirm",
      tone: "warn",
      icon: <Hotel className="h-3.5 w-3.5" />,
      label: `${snapshot.stats.awaitingConfirmation} vendor${
        snapshot.stats.awaitingConfirmation === 1 ? "" : "s"
      } awaiting confirmation`,
    });
  }

  // 4) Outstanding vendor balances
  if (snapshot.stats.unpaidVendorBalance > 0) {
    items.push({
      id: "unpaid",
      tone: "warn",
      icon: <Wallet className="h-3.5 w-3.5" />,
      label: `${formatINR(snapshot.stats.unpaidVendorBalance)} owed to vendors`,
    });
  }

  // All caught up: celebrate
  if (items.length === 0) {
    return (
      <section className="mb-8 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-emerald-200 text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm">
            <span className="font-medium text-navy">All caught up.</span>
            <span className="text-muted-foreground ml-1.5">
              No urgent ops issues — savor the calm.
            </span>
          </p>
        </div>
      </section>
    );
  }

  // Cap to 5 chips
  const visible = items.slice(0, 5);

  return (
    <section className="mb-8 rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground self-center whitespace-nowrap">
          Needs your attention
        </span>
        <div className="flex flex-wrap gap-2 flex-1">
          {visible.map((it) => (
            <Chip key={it.id} item={it} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ item }: { item: Item }) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
    item.tone === "urgent" &&
      "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    item.tone === "warn" &&
      "border-sand-200 bg-sand-50 text-sand-800 hover:bg-sand-100",
    item.tone === "info" &&
      "border-line bg-ivory text-navy hover:bg-white"
  );
  if (item.href) {
    return (
      <Link href={item.href} className={cls}>
        {item.icon}
        {item.label}
      </Link>
    );
  }
  return (
    <span className={cls}>
      {item.icon}
      {item.label}
    </span>
  );
}
