import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PreviewRenderer } from "@/components/preview-renderer";
import { PreviewActions } from "@/components/preview-actions";
import { prisma } from "@/lib/prisma";
import type { ItineraryContent } from "@/lib/ai";
import type { LineItemCategory, PricingItem } from "@/types";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const trip = await prisma.trip.findUnique({
    where: { id: params.id },
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
      lead: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!trip) notFound();

  const itinerary = (trip.itineraries[0]?.content ?? null) as
    | ItineraryContent
    | null;

  const accepted = trip.quotes.find((q) => q.status === "ACCEPTED");
  const nonRejected = trip.quotes.find((q) => q.status !== "REJECTED");
  const quote = accepted ?? nonRejected ?? trip.quotes[0] ?? null;

  const pricing = quote
    ? {
        items: quote.items.map((it) => ({
          id: it.id,
          category: it.category as LineItemCategory,
          label: it.label,
          cost: it.cost,
        })) as PricingItem[],
        markupPct: quote.markupPct,
        discountPct: quote.discountPct,
        markupAmount: Math.round(
          quote.totalCost * (quote.markupPct / 100)
        ),
        discountAmount: Math.round(
          quote.totalCost * (1 + quote.markupPct / 100) * (quote.discountPct / 100)
        ),
        totalCost: quote.totalCost,
        sellingPrice: quote.sellingPrice,
        profit: quote.profit,
        version: quote.version,
        status: quote.status,
      }
    : null;

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
            recipientPhone={trip.lead?.phone ?? null}
            recipientName={trip.lead?.name ?? null}
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
        />
      </main>
    </div>
  );
}
