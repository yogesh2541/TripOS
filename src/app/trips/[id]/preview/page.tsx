import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PreviewRenderer } from "@/components/preview-renderer";
import { PreviewActions } from "@/components/preview-actions";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import type { ItineraryContent } from "@/lib/ai";
import { buildProposalPricing, type LineItemCategory } from "@/types";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const { agencyId } = await requireAgency();
  const trip = await prisma.trip.findFirst({
    // Tenant-scoped: a trip id from another agency resolves to notFound().
    where: { id: params.id, agencyId },
    include: {
      // Latest itinerary version, not v1 — operators iterate.
      itineraries: { orderBy: { version: "desc" }, take: 1 },
      quotes: {
        orderBy: { version: "desc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
      travelSegments: {
        orderBy: [{ dayNumber: "asc" }, { departureTime: "asc" }],
      },
      contact: { select: { id: true, name: true, phone: true } },
      agency: {
        select: {
          settings: {
            select: {
              legalName: true,
              tradeName: true,
              logoUrl: true,
              phone: true,
              email: true,
              website: true,
              invoiceTerms: true,
            },
          },
        },
      },
    },
  });
  if (!trip) notFound();

  const itinerary = (trip.itineraries[0]?.content ?? null) as
    | ItineraryContent
    | null;

  const accepted = trip.quotes.find((q) => q.status === "ACCEPTED");
  const nonRejected = trip.quotes.find((q) => q.status !== "REJECTED");
  const quote = accepted ?? nonRejected ?? trip.quotes[0] ?? null;

  // Customer-safe pricing — selling amounts only, no cost / markup / profit
  // ever reaches the proposal. Mirrors the public /share page exactly.
  const pricing =
    quote && quote.items.length > 0
      ? buildProposalPricing({
          items: quote.items.map((it) => ({
            id: it.id,
            category: it.category as LineItemCategory,
            label: it.label,
            cost: it.cost,
          })),
          markupPct: quote.markupPct,
          discountPct: quote.discountPct,
          travelers: trip.travelers,
        })
      : null;

  const settings = trip.agency.settings;
  const agencyName = settings?.tradeName || settings?.legalName || "TripCraft";
  const proposalAgency = {
    name: agencyName,
    logoUrl: settings?.logoUrl ?? null,
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    website: settings?.website ?? null,
    terms: settings?.invoiceTerms ?? null,
  };

  return (
    <div className="min-h-screen bg-ivory">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-ivory/85 backdrop-blur-md print:hidden">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href={`/trips/${trip.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>
          <PreviewActions
            tripId={trip.id}
            quoteId={quote?.id ?? null}
            recipientPhone={trip.contact?.phone ?? null}
            recipientName={trip.contact?.name ?? null}
            destination={trip.destination}
          />
        </div>
      </header>

      <main className="container py-10 md:py-16 max-w-5xl">
        <PreviewRenderer
          trip={{
            destination: trip.destination,
            days: trip.days,
            travelers: trip.travelers,
            startDate: trip.startDate,
            travelType: trip.travelType,
          }}
          itinerary={itinerary}
          pricing={pricing}
          segments={trip.travelSegments}
          agency={proposalAgency}
          meta={{
            version: quote?.version,
            preparedAt: (quote?.updatedAt ?? trip.updatedAt).toISOString(),
            validityDays: 14,
          }}
        />
      </main>
    </div>
  );
}
