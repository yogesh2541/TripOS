import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { LeadStatusPill } from "@/components/crm/contact-status-pill";
import { ContactStrip } from "@/components/crm/contact-strip";
import { LeadTimeline } from "@/components/crm/contact-timeline";
import { TaskList } from "@/components/crm/task-list";
import { ConvertCustomerDialog } from "@/components/crm/convert-customer-dialog";
import {
  CustomerPreferencesPanel,
  type CustomerPreferences,
} from "@/components/crm/customer-preferences-panel";
import {
  TravelerProfilesPanel,
  type LoyaltyEntry,
  type TravelerView,
} from "@/components/crm/traveler-profiles-panel";
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
import { OwnerPicker } from "@/components/crm/owner-picker";
import { prisma } from "@/lib/prisma";
import { listAgencyMembers, requireAgency } from "@/lib/session";
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
  const { agencyId, user } = await requireAgency();
  const canEdit = user.activeAgencyRole !== "VIEWER";

  const [contact, members] = await Promise.all([
    prisma.contact.findFirst({
      // Tenant-scoped: a contact id from another agency resolves to notFound().
      where: { id: params.id, agencyId, deletedAt: null },
      include: {
        travelers: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        trips: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { name: true, email: true } } },
        },
        tasks: { orderBy: [{ completedAt: "asc" }, { dueAt: "asc" }] },
        whatsappMessages: {
          orderBy: { createdAt: "asc" },
          take: 200,
        },
      },
    }),
    listAgencyMembers(agencyId),
  ]);
  if (!contact) notFound();

  const customerPrefs = (contact.preferences ?? {}) as CustomerPreferences;
  const isCustomer = contact.convertedAt !== null;

  // Serialise traveller dates to ISO for the client panel.
  const travelers: TravelerView[] = contact.travelers.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    relationship: t.relationship,
    isPrimary: t.isPrimary,
    dateOfBirth: t.dateOfBirth?.toISOString() ?? null,
    gender: t.gender,
    nationality: t.nationality,
    passportNumber: t.passportNumber,
    passportExpiry: t.passportExpiry?.toISOString() ?? null,
    passportIssueCountry: t.passportIssueCountry,
    visaNotes: t.visaNotes,
    dietary: t.dietary,
    loyaltyNumbers: Array.isArray(t.loyaltyNumbers)
      ? (t.loyaltyNumbers as unknown as LoyaltyEntry[])
      : [],
    phone: t.phone,
    email: t.email,
    notes: t.notes,
  }));

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All contacts
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">
              {contact.name}
            </h1>
            <LeadStatusPill contactId={contact.id} status={contact.status} />
            {isCustomer && (
              <Badge variant="success">
                <Sparkles className="h-3 w-3" />
                Customer
              </Badge>
            )}
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            Source · {LEAD_SOURCE_LABEL[contact.source]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <ContactStrip
              contactId={contact.id}
              leadName={contact.name}
              phone={contact.phone}
              email={contact.email}
            />
            <OwnerPicker
              kind="contact"
              entityId={contact.id}
              currentOwnerId={contact.ownerId}
              members={members.map((m) => ({ id: m.id, name: m.name }))}
              canAssign={canEdit}
            />
            <WhatsappBadge scope={{ contactId: contact.id }} href="/communications" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contact.phone ? (
            <WhatsappComposer
              defaultPhone={contact.phone}
              recipientName={contact.name}
              link={{ contactId: contact.id }}
            />
          ) : null}
          {!isCustomer && <ConvertCustomerDialog contactId={contact.id} />}
          <Link href={`/trips/new?contactId=${contact.id}`}>
            <Button variant={isCustomer ? "accent" : "default"}>
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
              {contact.trips.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {contact.trips.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="travellers">
              Travellers
              {travelers.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {travelers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">
              Activity
              {contact.activities.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {contact.activities.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks
              {contact.tasks.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {contact.tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              WhatsApp
              {contact.whatsappMessages.length > 0 && (
                <span className="ml-2 text-xs opacity-70">
                  {contact.whatsappMessages.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Overview contact={contact} />
          </TabsContent>

          <TabsContent value="trips">
            {contact.trips.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-paper-2 p-12 text-center text-sm text-muted">
                No trips linked yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {contact.trips.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/trips/${t.id}`}
                      className="flex items-center justify-between rounded-lg border border-line bg-paper p-5 hover:shadow-soft transition-all group"
                    >
                      <div>
                        <p className="font-display text-xl text-ink">
                          {t.destination}
                        </p>
                        <p className="text-xs text-muted mt-1">
                          {t.days} days · {t.travelers} travelers ·{" "}
                          {t.travelType}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={TRIP_STATUS_TONE[t.status]}>
                          {TRIP_STATUS_LABEL[t.status]}
                        </Badge>
                        <ArrowUpRight className="h-5 w-5 text-muted group-hover:text-ink transition-colors" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="travellers">
            <TravelerProfilesPanel
              contactId={contact.id}
              travelers={travelers}
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="activity">
            <LeadTimeline
              contactId={contact.id}
              activities={contact.activities}
            />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList contactId={contact.id} tasks={contact.tasks} />
          </TabsContent>

          <TabsContent value="whatsapp">
            <div className="space-y-3">
              {contact.phone ? (
                <div className="flex items-center justify-end">
                  <WhatsappComposer
                    defaultPhone={contact.phone}
                    recipientName={contact.name}
                    link={{ contactId: contact.id }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-paper-2 p-4 text-xs text-muted">
                  Add a phone number to send WhatsApp.
                </div>
              )}
              <WhatsappThread messages={contact.whatsappMessages} />
            </div>
          </TabsContent>
        </Tabs>

        <aside className="lg:sticky lg:top-24 space-y-5">
          <CustomerPreferencesPanel
            contactId={contact.id}
            initial={customerPrefs}
          />
          <SidePanel title="Inquiry">
            <PanelRow label="Destination" value={contact.destination ?? "—"} />
            <PanelRow
              label="Travel dates"
              value={
                contact.travelStartDate
                  ? `${formatDate(contact.travelStartDate)}${
                      contact.travelEndDate
                        ? ` — ${formatDate(contact.travelEndDate)}`
                        : ""
                    }`
                  : "—"
              }
            />
            <PanelRow label="Adults" value={String(contact.adults)} />
            <PanelRow
              label="Budget"
              value={contact.budget ? formatINR(contact.budget) : "—"}
            />
          </SidePanel>

          <SidePanel title="Follow-up">
            <PanelRow
              label="Next"
              value={
                contact.nextFollowUpAt ? formatDate(contact.nextFollowUpAt) : "Not scheduled"
              }
            />
          </SidePanel>

          {contact.notes && (
            <SidePanel title="Notes">
              <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                {contact.notes}
              </p>
            </SidePanel>
          )}
        </aside>
      </div>
    </PageShell>
  );
}

function Overview({
  contact,
}: {
  contact: { destination: string | null; budget: number | null; adults: number; notes: string | null };
}) {
  return (
    <div className="rounded-lg border border-line bg-paper p-6 md:p-8 space-y-6">
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        <Field label="Destination" value={contact.destination ?? "—"} />
        <Field label="Adults" value={String(contact.adults)} />
        <Field
          label="Budget"
          value={contact.budget ? formatINR(contact.budget) : "—"}
        />
      </div>
      {contact.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
            Notes
          </p>
          <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
            {contact.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
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
    <section className="rounded-lg border border-line bg-paper p-5 space-y-3">
      <p className="tc-eyebrow gold">
        {title}
      </p>
      {children}
    </section>
  );
}

function PanelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
