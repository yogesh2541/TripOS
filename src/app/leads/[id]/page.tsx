import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LeadStatusPill } from "@/components/crm/lead-status-pill";
import { ContactStrip } from "@/components/crm/contact-strip";
import { LeadTimeline } from "@/components/crm/lead-timeline";
import { TaskList } from "@/components/crm/task-list";
import { ConvertCustomerDialog } from "@/components/crm/convert-customer-dialog";
import {
  CustomerPreferencesPanel,
  type CustomerPreferences,
} from "@/components/crm/customer-preferences-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { WhatsappBadge } from "@/components/whatsapp/whatsapp-badge";
import { WhatsappComposer } from "@/components/whatsapp/whatsapp-composer";
import { WhatsappThread } from "@/components/whatsapp/whatsapp-thread";
import { prisma } from "@/lib/prisma";
import {
  LEAD_SOURCE_LABEL,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
} from "@/lib/crm";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await prisma.lead.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      customer: true,
      trips: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      activities: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }] },
      whatsappMessages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
  if (!lead) notFound();

  const customerPrefs = (lead.customer?.preferences ?? {}) as CustomerPreferences;

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All leads
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-5xl text-navy leading-tight">
              {lead.name}
            </h1>
            <LeadStatusPill leadId={lead.id} status={lead.status} />
            {lead.customer && (
              <Badge variant="success">
                <Sparkles className="h-3 w-3" />
                Customer
              </Badge>
            )}
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Source · {LEAD_SOURCE_LABEL[lead.source]}
          </p>
          <ContactStrip
            leadId={lead.id}
            leadName={lead.name}
            phone={lead.phone}
            email={lead.email}
          />
          <WhatsappBadge
            scope={{ leadId: lead.id }}
            href="/communications"
          />
        </div>
        <div className="flex items-center gap-2">
          {lead.phone ? (
            <WhatsappComposer
              defaultPhone={lead.phone}
              recipientName={lead.name}
              link={{ leadId: lead.id }}
            />
          ) : null}
          {!lead.customer && <ConvertCustomerDialog leadId={lead.id} />}
          <Link href={`/trips/new?leadId=${lead.id}`}>
            <Button variant={lead.customer ? "accent" : "default"}>
              <Plus className="h-4 w-4" />
              Create trip
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] items-start">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trips">
              Trips
              {lead.trips.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {lead.trips.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">
              Activity
              {lead.activities.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {lead.activities.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks
              {lead.tasks.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {lead.tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              WhatsApp
              {lead.whatsappMessages.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {lead.whatsappMessages.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Overview lead={lead} />
          </TabsContent>

          <TabsContent value="trips">
            {lead.trips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center text-sm text-muted-foreground">
                No trips linked yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {lead.trips.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/trips/${t.id}`}
                      className="flex items-center justify-between rounded-2xl border border-line bg-white p-5 hover:shadow-soft transition-all group"
                    >
                      <div>
                        <p className="font-display text-xl text-navy">
                          {t.destination}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.days} days · {t.travelers} travelers ·{" "}
                          {t.travelType}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={TRIP_STATUS_TONE[t.status]}>
                          {TRIP_STATUS_LABEL[t.status]}
                        </Badge>
                        <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-navy transition-colors" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="activity">
            <LeadTimeline
              leadId={lead.id}
              activities={lead.activities}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList leadId={lead.id} tasks={lead.tasks} />
          </TabsContent>

          <TabsContent value="whatsapp">
            <div className="space-y-3">
              {lead.phone ? (
                <div className="flex items-center justify-end">
                  <WhatsappComposer
                    defaultPhone={lead.phone}
                    recipientName={lead.name}
                    link={{ leadId: lead.id }}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 text-xs text-muted-foreground">
                  Add a phone number to send WhatsApp.
                </div>
              )}
              <WhatsappThread messages={lead.whatsappMessages} />
            </div>
          </TabsContent>
        </Tabs>

        <aside className="lg:sticky lg:top-24 space-y-5">
          {lead.customer && (
            <CustomerPreferencesPanel
              customerId={lead.customer.id}
              initial={customerPrefs}
            />
          )}
          <SidePanel title="Inquiry">
            <PanelRow label="Destination" value={lead.destination ?? "—"} />
            <PanelRow
              label="Travel dates"
              value={
                lead.travelStartDate
                  ? `${formatDate(lead.travelStartDate)}${
                      lead.travelEndDate
                        ? ` — ${formatDate(lead.travelEndDate)}`
                        : ""
                    }`
                  : "—"
              }
            />
            <PanelRow label="Adults" value={String(lead.adults)} />
            <PanelRow
              label="Budget"
              value={lead.budget ? formatINR(lead.budget) : "—"}
            />
          </SidePanel>

          <SidePanel title="Follow-up">
            <PanelRow
              label="Next"
              value={
                lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "Not scheduled"
              }
            />
          </SidePanel>

          {lead.notes && (
            <SidePanel title="Notes">
              <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                {lead.notes}
              </p>
            </SidePanel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Overview({
  lead,
}: {
  lead: { destination: string | null; budget: number | null; adults: number; notes: string | null };
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 md:p-8 space-y-6">
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Destination" value={lead.destination ?? "—"} />
        <Field label="Adults" value={String(lead.adults)} />
        <Field
          label="Budget"
          value={lead.budget ? formatINR(lead.budget) : "—"}
        />
      </div>
      {lead.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Notes
          </p>
          <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
            {lead.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-base text-ink">{value}</p>
    </div>
  );
}

function SidePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 space-y-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-sand-700">
        {title}
      </p>
      {children}
    </section>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
