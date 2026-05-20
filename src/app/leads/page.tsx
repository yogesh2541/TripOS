import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LeadKanban, type KanbanLead } from "@/components/crm/lead-kanban";
import { NewLeadDialog } from "@/components/crm/lead-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { getWhatsappStatsForEntities } from "@/server/services/whatsapp";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const user = await getOrCreateDemoUser();
  const leads = await prisma.lead.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      destination: true,
      source: true,
      budget: true,
      adults: true,
      travelStartDate: true,
      nextFollowUpAt: true,
      status: true,
    },
  });

  const waStats = await getWhatsappStatsForEntities({
    userId: user.id,
    scope: "leadId",
    ids: leads.map((l) => l.id),
  });

  const kanbanLeads: KanbanLead[] = leads.map((l) => {
    const w = waStats.get(l.id);
    return {
      id: l.id,
      name: l.name,
      destination: l.destination,
      source: l.source,
      budget: l.budget,
      adults: l.adults,
      travelStartDate: l.travelStartDate,
      nextFollowUpAt: l.nextFollowUpAt,
      status: l.status,
      wa: w
        ? {
            count: w.count,
            unreadInbound: w.unreadInbound,
            lastDirection: w.lastDirection,
          }
        : null,
    };
  });

  return (
    <PageShell>
      <header className="flex items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Pipeline
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Leads
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Drag a card across columns to move it through your pipeline.
          </p>
        </div>
        <NewLeadDialog />
      </header>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Your pipeline starts here"
          body="Capture your first inquiry — Instagram DM, walk-in, referral, anywhere. From there you'll quote, book, and run the trip."
          action={<NewLeadDialog />}
          hint="Step 1 of the funnel"
        />
      ) : (
        <LeadKanban leads={kanbanLeads} />
      )}
    </PageShell>
  );
}
