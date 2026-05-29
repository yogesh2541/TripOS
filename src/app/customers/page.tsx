import Link from "next/link";
import { ArrowUpRight, Sparkles, Heart } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ContactStrip } from "@/components/crm/contact-strip";
import { CustomersTable, type CustomerRow } from "@/components/crm/customers-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewToggle } from "@/components/ui/view-toggle";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import { getWhatsappStatsForEntities } from "@/server/services/whatsapp";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const { agencyId } = await requireAgency();
  const view = searchParams.view === "table" ? "table" : "cards";

  // A "customer" is simply a contact who has converted (has a first booking).
  const customers = await prisma.contact.findMany({
    where: { agencyId, deletedAt: null, convertedAt: { not: null } },
    include: {
      trips: {
        where: { deletedAt: null },
        include: {
          bookings: {
            where: { status: { not: "CANCELLED" } },
            select: { paidAmount: true, totalAmount: true },
          },
        },
      },
    },
    orderBy: { convertedAt: "desc" },
  });

  const enriched = customers.map((c) => {
    const lifetimePaid = c.trips.reduce(
      (sum, t) => sum + t.bookings.reduce((s, b) => s + (b.paidAmount ?? 0), 0),
      0
    );
    const lifetimeBooked = c.trips.reduce(
      (sum, t) => sum + t.bookings.reduce((s, b) => s + (b.totalAmount ?? 0), 0),
      0
    );
    return { ...c, lifetimePaid, lifetimeBooked };
  });

  const waStats = await getWhatsappStatsForEntities({
    agencyId,
    scope: "contactId",
    ids: enriched.map((c) => c.id),
  });

  const customerRows: CustomerRow[] = enriched.map((c) => {
    const w = waStats.get(c.id);
    return {
      id: c.id,
      name: c.name,
      convertedAt: c.convertedAt,
      tripCount: c.trips.length,
      booked: c.lifetimeBooked,
      paid: c.lifetimePaid,
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
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">Repeat clients</p>
          <h1 className="tc-page-title mt-2.5">Customers</h1>
          <p className="tc-page-sub">
            Contacts who've booked — your roster of repeat clients.
          </p>
        </div>
        {enriched.length > 0 ? (
          <ViewToggle
            defaultValue="cards"
            options={[
              { value: "cards", label: "Cards", icon: "grid" },
              { value: "table", label: "Table", icon: "table" },
            ]}
          />
        ) : null}
      </header>

      {enriched.length === 0 ? (
        <EmptyState
          icon={<Heart className="h-5 w-5" />}
          title="Customers appear when contacts say yes"
          body="Once a contact is converted, they show here with lifetime value, contact details and trip history."
          action={
            <Link href="/contacts">
              <Button variant="default">
                <Sparkles className="h-4 w-4" />
                Open pipeline
              </Button>
            </Link>
          }
          hint="Tip: convert a contact from their profile or the kanban"
          variant="card"
        />
      ) : view === "table" ? (
        <CustomersTable customers={customerRows} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {enriched.map((c) => (
            <li key={c.id}>
              <article className="rounded-lg border border-line bg-paper p-6 shadow-soft hover:shadow-lift transition-all flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-2xl text-ink">
                        {c.name}
                      </p>
                      {(() => {
                        const w = waStats.get(c.id);
                        return w ? (
                          <InlineWhatsappBadge
                            count={w.count}
                            unreadInbound={w.unreadInbound}
                            lastDirection={w.lastDirection}
                          />
                        ) : null;
                      })()}
                    </div>
                    {c.convertedAt && (
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted font-mono tabular-nums">
                        Since {formatDate(c.convertedAt)}
                      </p>
                    )}
                  </div>
                  <ContactStrip
                    contactId={c.id}
                    leadName={c.name}
                    phone={c.phone}
                    email={c.email}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Trips" value={String(c.trips.length)} />
                  <Stat label="Booked" value={formatINR(c.lifetimeBooked)} />
                  <Stat label="Paid" value={formatINR(c.lifetimePaid)} />
                </div>

                <Link
                  href={`/contacts/${c.id}`}
                  className="text-xs uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5 self-start"
                >
                  Open profile
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-paper-2 border border-line px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-ink text-sm font-mono tabular-nums">{value}</p>
    </div>
  );
}
