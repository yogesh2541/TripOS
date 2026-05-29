// Build a self-contained snapshot for the proposal PDF — everything the
// renderer needs in one object so the route handler only worries about
// auth/tenancy. Mirrors what the HTML preview page assembles.

import "server-only";
import type { Quote, QuoteItem, TravelSegment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readDay, type ItineraryContent } from "@/lib/ai";
import {
  buildProposalPricing,
  type LineItemCategory,
  type ProposalPricing,
} from "@/types";

const PROPOSAL_INCLUDE = {
  items: { orderBy: { position: "asc" as const } },
  trip: {
    include: {
      itineraries: { orderBy: { version: "desc" as const }, take: 1 },
      travelSegments: {
        orderBy: [
          { dayNumber: "asc" as const },
          { departureTime: "asc" as const },
        ],
      },
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
  },
};

export type ProposalPdfSnapshot = {
  trip: {
    destination: string;
    days: number;
    travelers: number;
    startDate: Date | null;
    travelType: string;
  };
  itinerary: ItineraryContent | null;
  segments: TravelSegment[];
  pricing: ProposalPricing | null;
  agency: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    terms: string | null;
  };
  branding: {
    theme: "classic" | "editorial" | "minimal";
    accent: string;
    coverStyle: "photo" | "gradient" | "solid";
    showAtAGlance: boolean;
    showInclusions: boolean;
    showTerms: boolean;
    signatureNote: string | null;
    repeatLogo: boolean;
  };
  meta: {
    version: number;
    preparedAt: Date;
    validityDays: number;
  };
};

const SAND = "#C8A96A";

// @react-pdf renders server-side and must *fetch* every <Image src>. Uploaded
// images are stored relative (`/uploads/x.jpg`), which has no origin to
// resolve against on the server — so the cover/logo would silently drop.
// Promote relative paths to absolute using the app's public origin. Already-
// absolute (http/https) or data: URLs pass through untouched.
function toAbsoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:)/i.test(url)) return url;
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function buildSnapshot(
  quote: Quote & {
    items: QuoteItem[];
    trip: {
      destination: string;
      days: number;
      travelers: number;
      startDate: Date | null;
      travelType: string;
      itineraries: { content: unknown }[];
      travelSegments: TravelSegment[];
      agency: {
        settings: {
          legalName: string;
          tradeName: string | null;
          logoUrl: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          invoiceTerms: string | null;
          proposalTheme: string;
          proposalAccentColor: string | null;
          proposalCoverStyle: string;
          proposalShowAtAGlance: boolean;
          proposalShowInclusions: boolean;
          proposalShowTerms: boolean;
          proposalSignatureNote: string | null;
          proposalRepeatLogo: boolean;
        } | null;
      };
    };
  }
): ProposalPdfSnapshot {
  const settings = quote.trip.agency.settings;
  const agencyName =
    settings?.tradeName?.trim() ||
    settings?.legalName?.trim() ||
    "TripCraft";

  // Same readDay normalization the HTML renderer applies.
  const rawItin = quote.trip.itineraries[0]?.content;
  const itinerary: ItineraryContent | null = rawItin
    ? (() => {
        const i = rawItin as ItineraryContent;
        return {
          ...i,
          // Absolutize so the server-side PDF renderer can fetch them.
          coverImageUrl: toAbsoluteUrl(i.coverImageUrl) ?? undefined,
          days: i.days.map((d) => {
            const day = readDay(d);
            return { ...day, imageUrl: toAbsoluteUrl(day.imageUrl) ?? undefined };
          }),
        };
      })()
    : null;

  const pricing =
    quote.items.length > 0
      ? buildProposalPricing({
          items: quote.items.map((it) => ({
            id: it.id,
            category: it.category as LineItemCategory,
            label: it.label,
            cost: it.cost,
          })),
          markupPct: quote.markupPct,
          discountPct: quote.discountPct,
          travelers: quote.trip.travelers,
        })
      : null;

  // Branding falls back to defaults so an agency that never visited
  // /settings/proposal still gets a well-rendered document.
  const themeRaw = settings?.proposalTheme ?? "classic";
  const theme: ProposalPdfSnapshot["branding"]["theme"] =
    themeRaw === "editorial" || themeRaw === "minimal" ? themeRaw : "classic";
  const coverRaw = settings?.proposalCoverStyle ?? "photo";
  const coverStyle: ProposalPdfSnapshot["branding"]["coverStyle"] =
    coverRaw === "gradient" || coverRaw === "solid" ? coverRaw : "photo";

  return {
    trip: {
      destination: quote.trip.destination,
      days: quote.trip.days,
      travelers: quote.trip.travelers,
      startDate: quote.trip.startDate,
      travelType: quote.trip.travelType,
    },
    itinerary,
    segments: quote.trip.travelSegments,
    pricing,
    agency: {
      name: agencyName,
      logoUrl: toAbsoluteUrl(settings?.logoUrl),
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      website: settings?.website ?? null,
      terms: settings?.invoiceTerms ?? null,
    },
    branding: {
      theme,
      // Minimal theme always forces a flat cover.
      coverStyle: theme === "minimal" ? "solid" : coverStyle,
      accent: settings?.proposalAccentColor?.trim() || SAND,
      showAtAGlance: settings?.proposalShowAtAGlance ?? true,
      showInclusions: settings?.proposalShowInclusions ?? true,
      showTerms: settings?.proposalShowTerms ?? true,
      signatureNote: settings?.proposalSignatureNote?.trim() || null,
      repeatLogo: settings?.proposalRepeatLogo ?? true,
    },
    meta: {
      version: quote.version,
      preparedAt: quote.updatedAt,
      validityDays: 14,
    },
  };
}

/** Fetch by public share token. Used by the customer-facing PDF endpoint. */
export async function getProposalSnapshotByToken(
  token: string
): Promise<ProposalPdfSnapshot | null> {
  const quote = await prisma.quote.findUnique({
    where: { shareToken: token },
    include: PROPOSAL_INCLUDE,
  });
  if (!quote) return null;
  return buildSnapshot(quote);
}

/** Fetch by quoteId — caller is responsible for agency-tenancy auth. */
export async function getProposalSnapshotByQuoteId(
  quoteId: string,
  agencyId: string
): Promise<ProposalPdfSnapshot | null> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, trip: { agencyId } },
    include: PROPOSAL_INCLUDE,
  });
  if (!quote) return null;
  return buildSnapshot(quote);
}

export function proposalPdfFilename(snap: ProposalPdfSnapshot): string {
  const dest = snap.trip.destination.replace(/[^A-Za-z0-9-]+/g, "-");
  return `${snap.agency.name.replace(/[^A-Za-z0-9-]+/g, "-")}-${dest}-v${snap.meta.version}.pdf`;
}
