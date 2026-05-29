"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  cancelAgencySubscriptionAction,
  extendAgencyTrialAction,
  setAgencyPlanAction,
} from "@/server/actions/platform";
import { formatDate } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  members: number;
  trips: number;
  contacts: number;
  plan: PlanTier | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

const STATUS_TONE: Record<
  SubscriptionStatus,
  "success" | "info" | "warn" | "danger" | "muted"
> = {
  ACTIVE: "success",
  TRIALING: "info",
  PAST_DUE: "warn",
  CANCELLED: "danger",
  EXPIRED: "muted",
};

export function AdminAgenciesTable({
  agencies,
  query,
}: {
  agencies: Row[];
  query: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(query);

  // Debounced search → drives the ?q= server query.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q === query) return;
      router.push(q.trim() ? `/admin?q=${encodeURIComponent(q.trim())}` : "/admin");
    }, 350);
    return () => clearTimeout(t);
  }, [q, query, router]);

  return (
    <div className="space-y-3">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search agency, slug or owner email"
          className="h-9 w-full rounded-[9px] border border-line bg-paper pl-8 pr-3 text-sm focus:outline-none focus:border-[var(--gold-line)]"
        />
      </div>

      <div className="rounded-lg border border-line bg-paper overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="tc-tbl min-w-[820px]">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Owner</th>
                <th>Plan</th>
                <th className="r">Members</th>
                <th className="r">Trips</th>
                <th>Renews / ends</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {agencies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-8">
                    No agencies found.
                  </td>
                </tr>
              ) : (
                agencies.map((a) => (
                  <AgencyRow key={a.id} a={a} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AgencyRow({ a }: { a: Row }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          toast.success(ok);
          router.refresh();
        } else {
          toast.error(res.error || "Action failed");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  const endLabel =
    a.status === "TRIALING"
      ? a.trialEndsAt
        ? `Trial ends ${formatDate(a.trialEndsAt)}`
        : "—"
      : a.currentPeriodEnd
        ? `Renews ${formatDate(a.currentPeriodEnd)}`
        : "—";

  return (
    <tr>
      <td>
        <div className="cell-lead">
          <span className="tc-ava-sm">
            {a.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="t-strong truncate">{a.name}</div>
            <div className="t-mut font-mono">/{a.slug}</div>
          </div>
        </div>
      </td>
      <td className="t-mut">
        {a.ownerEmail ? (
          <span className="truncate">{a.ownerEmail}</span>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div className="flex items-center gap-2">
          <span className="t-strong">{a.plan ?? "—"}</span>
          {a.status ? (
            <Badge variant={STATUS_TONE[a.status]}>{a.status}</Badge>
          ) : null}
        </div>
      </td>
      <td className="r mono tnum">{a.members}</td>
      <td className="r mono tnum">{a.trips}</td>
      <td className="t-mut">{endLabel}</td>
      <td className="t-mut font-mono">{formatDate(a.createdAt)}</td>
      <td className="r">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={pending}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-muted hover:bg-paper-2 hover:text-ink disabled:opacity-50"
              aria-label="Agency actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Subscription</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => setAgencyPlanAction({ agencyId: a.id, plan: "STARTER" }),
                  "Set to Starter (active)"
                )
              }
            >
              Set plan · Starter
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => setAgencyPlanAction({ agencyId: a.id, plan: "PRO" }),
                  "Set to Pro (active)"
                )
              }
            >
              Set plan · Pro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => extendAgencyTrialAction({ agencyId: a.id, days: 14 }),
                  "Trial extended 14 days"
                )
              }
            >
              Extend trial · 14 days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => extendAgencyTrialAction({ agencyId: a.id, days: 30 }),
                  "Trial extended 30 days"
                )
              }
            >
              Extend trial · 30 days
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                run(
                  () => setAgencyPlanAction({ agencyId: a.id, plan: "TRIAL" }),
                  "Reset to a fresh trial"
                )
              }
            >
              Reset to trial
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-bad"
              onClick={() => {
                if (
                  confirm(
                    `Cancel ${a.name}'s subscription now? They'll drop to limited access.`
                  )
                ) {
                  run(
                    () => cancelAgencySubscriptionAction(a.id),
                    "Subscription cancelled"
                  );
                }
              }}
            >
              Cancel subscription
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
