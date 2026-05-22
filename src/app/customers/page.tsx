import Link from "next/link";
import { ArrowUpRight, Sparkles, Heart } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { ContactStrip } from "@/components/crm/contact-strip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";
import { getWhatsappStatsForEntities } from "@/server/services/whatsapp";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { agencyId } = await requireAgency();

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

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Repeat clients
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Customers
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Contacts who've booked — your roster of repeat clients.
          </p>
        </div>
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
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {enriched.map((c) => (
            <li key={c.id}>
              <article className="rounded-2xl border border-line bg-white p-6 shadow-soft hover:shadow-lift transition-all flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display text-2xl text-navy">
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
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
                  className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-navy transition-colors inline-flex items-center gap-1.5 self-start"
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
    <div className="rounded-xl bg-ivory border border-line/60 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-navy text-sm">{value}</p>
    </div>
  );
}
