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
      <section className="mb-8 rounded-lg border border-ok/30 bg-ok-soft/40 p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper border border-ok/30 text-ok">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm">
            <span className="font-medium text-ink">All caught up.</span>
            <span className="text-muted ml-1.5">
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
    <section className="mb-8 rounded-lg border border-line bg-paper p-4 shadow-soft">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted self-center whitespace-nowrap">
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
    "inline-flex items-center gap-1.5 rounded-[6px] border px-3 py-1 text-xs transition-colors",
    item.tone === "urgent" &&
      "border-bad/40 bg-bad-soft text-bad hover:bg-bad/10",
    item.tone === "warn" &&
      "border-warn/40 bg-warn-soft text-warn hover:bg-warn/10",
    item.tone === "info" &&
      "border-line bg-paper-2 text-ink hover:bg-paper"
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
