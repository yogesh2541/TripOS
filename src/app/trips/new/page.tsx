import { PageShell } from "@/components/page-shell";
import { NewTripTabs } from "@/components/new-trip-tabs";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";

export const dynamic = "force-dynamic";

function daysBetween(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: { contactId?: string };
}) {
  const { agencyId } = await requireAgency();
  let prefill = undefined;

  if (searchParams.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: searchParams.contactId, agencyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        destination: true,
        travelStartDate: true,
        travelEndDate: true,
        adults: true,
        budget: true,
        notes: true,
      },
    });
    if (contact) {
      prefill = {
        contactId: contact.id,
        leadName: contact.name,
        destination: contact.destination,
        startDate: contact.travelStartDate
          ? contact.travelStartDate.toISOString().slice(0, 10)
          : null,
        days: daysBetween(contact.travelStartDate, contact.travelEndDate),
        travelers: contact.adults,
        budget: contact.budget,
        notes: contact.notes,
      };
    }
  }

  return (
    <PageShell>
      <div className="text-center mb-12">
        <p className="tc-eyebrow gold">New trip</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl text-ink">
          A few details, then we craft.
        </h1>
        <p className="mt-3 text-base text-muted max-w-md mx-auto">
          Walk through the wizard for a fresh idea, or paste a detailed brief
          when you already know the day-by-day.
        </p>
      </div>
      <NewTripTabs prefill={prefill} />
    </PageShell>
  );
}
