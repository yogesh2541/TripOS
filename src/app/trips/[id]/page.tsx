import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Eye, MapPin, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PageShell } from "@/components/page-shell";
import { QuoteBuilder, type QuoteData } from "@/components/quotes/quote-builder";
import { BookingPanel } from "@/components/bookings/booking-panel";
import { OperationsPanel } from "@/components/operations/operations-panel";
import { PlanEditorTabs } from "@/components/operations/plan-editor-tabs";
import { TripWorkflowStepper } from "@/components/operations/trip-workflow-stepper";
import { LinkLeadControl } from "@/components/crm/link-contact-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WhatsappBadge } from "@/components/whatsapp/whatsapp-badge";
import { WhatsappComposer } from "@/components/whatsapp/whatsapp-composer";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { getTripWorkflow } from "@/server/services/trip-workflow";
import { isRazorpayConfiguredForAgency } from "@/server/services/integrations";
import type { ItineraryContent } from "@/lib/ai";
import type { LineItemCategory, PricingItem } from "@/types";
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE } from "@/lib/crm";

export const dynamic = "force-dynamic";

export default async function TripWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const { agencyId, user } = await requireAgency();
  const canEdit = user.activeAgencyRole !== "VIEWER";
  const paymentsConfigured = await isRazorpayConfiguredForAgency(agencyId);
  const [trip, leadOptions] = await Promise.all([
    prisma.trip.findFirst({
    // Tenant-scoped: a trip id from another agency resolves to notFound().
    where: { id: params.id, agencyId },
    include: {
      contact: { select: { id: true, name: true, phone: true } },
      itineraries: {
        where: { version: 1 },
        take: 1,
      },
      quotes: {
        orderBy: { version: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
      bookings: {
        where: { status: { not: "CANCELLED" } },
        include: {
          quote: { select: { version: true } },
          payments: { orderBy: { paidAt: "desc" } },
          paymentLinks: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              status: true,
              shortUrl: true,
              createdAt: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              grandTotal: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      travelSegments: {
        orderBy: [{ dayNumber: "asc" }, { departureTime: "asc" }],
      },
    },
    }),
    // Picker options for linking this trip to a CRM contact.
    prisma.contact.findMany({
      where: { agencyId, deletedAt: null },
      select: { id: true, name: true, phone: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  if (!trip) notFound();

  const workflow = await getTripWorkflow(trip.id);

  const activeBooking = trip.bookings[0] ?? null;
  const segments = trip.travelSegments;

  const itineraryContent = (trip.itineraries[0]?.content ?? null) as
    | ItineraryContent
    | null;

  const quotes: QuoteData[] = trip.quotes.map((q) => ({
    id: q.id,
    version: q.version,
    status: q.status,
    markupPct: q.markupPct,
    discountPct: q.discountPct,
    sellingPrice: q.sellingPrice,
    shareToken: q.shareToken,
    internalNotes: q.internalNotes,
    items: q.items.map((it) => ({
      id: it.id,
      category: it.category as LineItemCategory,
      label: it.label,
      cost: it.cost,
    })) as PricingItem[],
  }));

  return (
    <PageShell>
      <Link
        href="/trips"
        className="tc-btn tc-btn-ghost tc-btn-sm mb-3.5 inline-flex w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Trips
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={TRIP_STATUS_TONE[trip.status]}>
              {TRIP_STATUS_LABEL[trip.status]}
            </Badge>
            {trip.travelType ? (
              <Badge variant="muted">{trip.travelType}</Badge>
            ) : null}
            <WhatsappBadge scope={{ tripId: trip.id }} href="/communications" />
          </div>
          <h1 className="tc-page-title">{trip.destination}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-[15px] w-[15px] text-gold-deep" />
              {trip.startDate ? formatDate(trip.startDate) : "Dates TBD"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono tabular-nums">{trip.days}</span> days
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-[15px] w-[15px] text-gold-deep" />
              <span className="font-mono tabular-nums">{trip.travelers}</span>{" "}
              travelers
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-[15px] w-[15px] text-gold-deep" />
              {trip.destination}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LinkLeadControl
            tripId={trip.id}
            contact={trip.contact ? { id: trip.contact.id, name: trip.contact.name } : null}
            leads={leadOptions}
            canEdit={canEdit}
          />
          {trip.contact?.phone ? (
            <WhatsappComposer
              defaultPhone={trip.contact.phone}
              recipientName={trip.contact.name}
              link={{ contactId: trip.contact.id, tripId: trip.id }}
            />
          ) : null}
          <Link href={`/trips/${trip.id}/preview`}>
            <Button variant="accent" size="sm">
              <Eye className="h-3.5 w-3.5" />
              Preview proposal
            </Button>
          </Link>
        </div>
      </div>

      {workflow ? (
        <div className="mb-6">
          <TripWorkflowStepper workflow={workflow} />
        </div>
      ) : null}

      {activeBooking && (
        <BookingPanel
          paymentsConfigured={paymentsConfigured}
          recipientPhone={trip.contact?.phone ?? null}
          recipientName={trip.contact?.name ?? null}
          destination={trip.destination}
          booking={{
            id: activeBooking.id,
            status: activeBooking.status,
            totalAmount: activeBooking.totalAmount,
            paidAmount: activeBooking.paidAmount,
            createdAt: activeBooking.createdAt,
            payments: activeBooking.payments,
            paymentLinks: activeBooking.paymentLinks,
            quoteVersion: activeBooking.quote.version,
            invoice: activeBooking.invoice,
          }}
        />
      )}

      <Tabs defaultValue="plan">
        <TabsList className="mb-6">
          <TabsTrigger value="plan">Plan & Quote</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] items-start">
            <PlanEditorTabs
              tripId={trip.id}
              destination={trip.destination}
              tripDays={trip.days}
              itineraryContent={itineraryContent}
              segments={segments}
              tripStartDate={trip.startDate?.toISOString() ?? null}
            />
            <div className="lg:sticky lg:top-24">
              <QuoteBuilder
                tripId={trip.id}
                travelers={trip.travelers}
                quotes={quotes}
                itinerary={itineraryContent}
                segments={segments}
                destination={trip.destination}
                recipient={
                  trip.contact
                    ? { name: trip.contact.name, phone: trip.contact.phone }
                    : null
                }
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="operations">
          <OperationsPanel tripId={trip.id} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
