import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { WhatsappAutomationTrigger } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { AutomationRuleCard } from "@/components/whatsapp/automation-rule-card";
import { RunAutomationsNowButton } from "@/components/whatsapp/run-automations-button";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";

export const dynamic = "force-dynamic";

const ALL_TRIGGERS: WhatsappAutomationTrigger[] = [
  "QUOTE_SENT_NO_REPLY_24H",
  "QUOTE_SENT_NO_REPLY_3D",
  "QUOTE_SENT_NO_REPLY_7D",
  "PAYMENT_DUE_T_MINUS_3",
  "PAYMENT_DUE_TODAY",
  "PAYMENT_OVERDUE_2D",
  "INVOICE_ISSUED",
  "TRIP_T_MINUS_7",
  "TRIP_T_MINUS_1",
  "TRIP_DEPARTURE_DAY",
  "TRIP_COMPLETED_THANKS",
];

export default async function CommsAutomationsPage() {
  const { agencyId } = await requireAgency();
  const [rules, templates] = await Promise.all([
    prisma.whatsappAutomationRule.findMany({
      where: { agencyId },
      include: { template: true },
    }),
    prisma.whatsappTemplate.findMany({
      where: { agencyId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const ruleByTrigger = new Map(rules.map((r) => [r.trigger, r]));

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <Link
            href="/communications"
            className="text-xs uppercase tracking-[0.18em] text-muted hover:text-ink inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Communications
          </Link>
          <h1 className="mt-2 tc-page-title">
            Automations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quietly busy in the background — reminders, follow-ups, trip nudges
            and post-trip thank-yous, each bound to a template you can edit.
          </p>
        </div>
        <RunAutomationsNowButton />
      </header>

      {templates.length === 0 ? (
        <EmptyState
          title="Create a template first"
          body="Automations can't fire without a template body. Head over to Templates and add at least one."
          action={
            <Link
              href="/communications/templates"
              className="underline underline-offset-4 text-ink"
            >
              Open templates
            </Link>
          }
          variant="card"
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {ALL_TRIGGERS.map((t) => {
            const r = ruleByTrigger.get(t);
            return (
              <AutomationRuleCard
                key={t}
                trigger={t}
                rule={
                  r
                    ? {
                        id: r.id,
                        enabled: r.enabled,
                        delayMinutes: r.delayMinutes,
                        template: r.template,
                      }
                    : null
                }
                templates={templates}
              />
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-muted">
        Runner cadence · invoke <code className="font-mono">GET /api/cron/whatsapp</code>{" "}
        every 5–15 minutes
      </p>
    </PageShell>
  );
}
