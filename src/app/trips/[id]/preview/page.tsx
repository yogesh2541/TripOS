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
              proposalTheme: true,
              proposalAccentColor: true,
              proposalCoverStyle: true,
              proposalShowAtAGlance: true,
              proposalShowInclusions: true,
              proposalShowTerms: true,
              proposalSignatureNote: true,
              proposalRepeatLogo: true,
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

  const proposalBranding = {
    theme: (settings?.proposalTheme ?? "classic") as
      | "classic"
      | "editorial"
      | "minimal",
    accentColor: settings?.proposalAccentColor ?? null,
    coverStyle: (settings?.proposalCoverStyle ?? "photo") as
      | "photo"
      | "gradient"
      | "solid",
    showAtAGlance: settings?.proposalShowAtAGlance ?? true,
    showInclusions: settings?.proposalShowInclusions ?? true,
    showTerms: settings?.proposalShowTerms ?? true,
    signatureNote: settings?.proposalSignatureNote ?? null,
    repeatLogo: settings?.proposalRepeatLogo ?? true,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line bg-[rgba(244,242,236,.85)] backdrop-blur-md print:hidden">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href={`/trips/${trip.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
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
            agencyName={proposalAgency.name}
            total={pricing?.total ?? null}
            perPerson={pricing?.perPerson ?? null}
            version={quote?.version ?? null}
            validityDays={14}
            preparedAt={(quote?.updatedAt ?? trip.updatedAt).toISOString()}
            dateRange={
              trip.startDate
                ? `${new Date(trip.startDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })} – ${new Date(
                    new Date(trip.startDate).getTime() +
                      (trip.days - 1) * 86400000
                  ).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`
                : null
            }
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl py-8 md:py-12 px-4 md:px-6">
        <div className="overflow-hidden rounded-xl border border-line shadow-lift print:border-0 print:shadow-none print:rounded-none">
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
            branding={proposalBranding}
            recipientName={trip.contact?.name ?? null}
            meta={{
              version: quote?.version,
              preparedAt: (quote?.updatedAt ?? trip.updatedAt).toISOString(),
              validityDays: 14,
            }}
          />
        </div>
      </main>
    </div>
  );
}
