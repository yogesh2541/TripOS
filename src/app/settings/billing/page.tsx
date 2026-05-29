import Link from "next/link";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/components/settings/upgrade-button";
import { requireAgency } from "@/lib/session";
import {
  getEffectivePlan,
  seatUsage,
} from "@/server/services/subscription";
import { PLANS, PRICING_ORDER, formatPlanPrice } from "@/lib/plans";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Billing · TripCraft" };

const STATUS_LABEL: Record<string, string> = {
  TRIALING: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment due",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export default async function BillingPage() {
  const { agencyId, user } = await requireAgency();
  const canManage = user.activeAgencyRole === "OWNER";
  const [plan, seats] = await Promise.all([
    getEffectivePlan(agencyId),
    seatUsage(agencyId),
  ]);

  const currentDef = PLANS[plan.tier];

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <header className="mb-8">
        <p className="tc-eyebrow gold">Settings</p>
        <h1 className="tc-page-title mt-2.5">Billing & plan</h1>
        <p className="tc-page-sub max-w-2xl">
          Your TripCraft subscription. Manage the plan your agency runs on and
          how many team members you can add.
        </p>
      </header>

      {/* Current plan */}
      <section className="rounded-lg border border-line bg-paper p-6 shadow-soft mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl text-ink">
                {currentDef.name} plan
              </h2>
              <Badge
                variant={
                  plan.needsUpgrade
                    ? "danger"
                    : plan.status === "ACTIVE"
                      ? "success"
                      : "accent"
                }
              >
                {STATUS_LABEL[plan.status] ?? plan.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {plan.trialActive && plan.trialEndsAt
                ? `Trial — ${plan.trialDaysLeft} day${
                    plan.trialDaysLeft === 1 ? "" : "s"
                  } left (ends ${formatDate(plan.trialEndsAt)}).`
                : plan.needsUpgrade
                  ? "Your trial has ended. Choose a plan to keep Pro features and your full team."
                  : "Your subscription is active."}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Team seats
            </p>
            <p className="mt-1 font-display text-2xl text-ink font-mono tabular-nums">
              {seats.used} / {seats.max}
            </p>
          </div>
        </div>
      </section>

      {/* Plan catalogue */}
      <div className="grid gap-5 md:grid-cols-2">
        {PRICING_ORDER.map((tier) => {
          const def = PLANS[tier];
          const isCurrent =
            plan.tier === tier && !plan.needsUpgrade && plan.status === "ACTIVE";
          const featured = tier === "PRO";
          return (
            <section
              key={tier}
              className={
                "rounded-lg border bg-paper p-6 shadow-soft flex flex-col " +
                (featured
                  ? "border-[var(--gold-line)] ring-1 ring-[var(--gold-line)]/30"
                  : "border-line")
              }
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-ink">{def.name}</h3>
                {featured && (
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-inkwash px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--on-dark)]">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{def.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-4xl text-ink font-mono tabular-nums">
                  {formatPlanPrice(def.priceMonthly)}
                </span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <p className="mt-1 text-xs text-muted font-mono tabular-nums">
                or {formatPlanPrice(def.priceAnnual)} / year (2 months free)
              </p>

              <ul className="mt-5 space-y-2 flex-1">
                {def.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-ok mt-0.5 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <div className="text-center text-sm text-ok font-medium py-2">
                    Your current plan
                  </div>
                ) : canManage ? (
                  <UpgradeButton
                    planName={def.name}
                    variant={featured ? "default" : "outline"}
                  />
                ) : (
                  <p className="text-center text-xs text-muted py-2">
                    Ask your agency owner to change the plan.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Prices in INR, exclusive of GST. Questions? Email billing@tripcraft.app
      </p>
    </PageShell>
  );
}
