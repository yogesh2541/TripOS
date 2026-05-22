import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LeadKanban, type KanbanLead } from "@/components/crm/contact-kanban";
import { LeadsTable, type LeadRow } from "@/components/crm/contacts-table";
import { NewLeadDialog } from "@/components/crm/contact-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewToggle } from "@/components/ui/view-toggle";
import { getWhatsappStatsForEntities } from "@/server/services/whatsapp";
import { prisma } from "@/lib/prisma";
import { listAgencyMembers, requireAgency } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const { agencyId, user } = await requireAgency();
  const view = searchParams.view === "table" ? "table" : "board";
  const canEdit = user.activeAgencyRole !== "VIEWER";

  const [leads, members] = await Promise.all([
    prisma.contact.findMany({
      where: { agencyId, deletedAt: null },
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
        createdAt: true,
        ownerId: true,
        owner: { select: { name: true } },
      },
    }),
    listAgencyMembers(agencyId),
  ]);

  const waStats = await getWhatsappStatsForEntities({
    agencyId,
    scope: "contactId",
    ids: leads.map((l) => l.id),
  });

  const waFor = (id: string) => {
    const w = waStats.get(id);
    return w
      ? {
          count: w.count,
          unreadInbound: w.unreadInbound,
          lastDirection: w.lastDirection,
        }
      : null;
  };

  const kanbanLeads: KanbanLead[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    destination: l.destination,
    source: l.source,
    budget: l.budget,
    adults: l.adults,
    travelStartDate: l.travelStartDate,
    nextFollowUpAt: l.nextFollowUpAt,
    status: l.status,
    wa: waFor(l.id),
  }));

  const tableLeads: LeadRow[] = leads.map((l) => ({
    id: l.id,
    name: l.name,
    destination: l.destination,
    source: l.source,
    status: l.status,
    budget: l.budget,
    adults: l.adults,
    travelStartDate: l.travelStartDate,
    nextFollowUpAt: l.nextFollowUpAt,
    ownerId: l.ownerId,
    ownerName: l.owner?.name ?? null,
    createdAt: l.createdAt,
    wa: waFor(l.id),
  }));

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Pipeline
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Contacts
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {view === "board"
              ? "Drag a card across columns to move it through your pipeline."
              : "Sort and scan your whole pipeline — click a row to open."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {leads.length > 0 ? (
            <ViewToggle
              defaultValue="board"
              options={[
                { value: "board", label: "Board", icon: "grid" },
                { value: "table", label: "Table", icon: "table" },
              ]}
            />
          ) : null}
          <NewLeadDialog />
        </div>
      </header>

      {leads.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Your pipeline starts here"
          body="Capture your first inquiry — Instagram DM, walk-in, referral, anywhere. From there you'll quote, book, and run the trip."
          action={<NewLeadDialog />}
          hint="Step 1 of the funnel"
        />
      ) : view === "table" ? (
        <LeadsTable
          leads={tableLeads}
          members={members.map((m) => ({ id: m.id, name: m.name }))}
          canEdit={canEdit}
        />
      ) : (
        <LeadKanban leads={kanbanLeads} />
      )}
    </PageShell>
  );
}
