"use client";

import { motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  Check,
  Compass,
  Mail,
  Map,
  MapPin,
  Phone,
  Plane,
  ShieldCheck,
  Train,
  Users,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { TravelSegment } from "@prisma/client";
import { readDay, type ItineraryContent, type ItineraryDay } from "@/lib/ai";
import type { ProposalPricing } from "@/types";
import { addDays, formatINR } from "@/lib/utils";

type Trip = {
  destination: string;
  days: number;
  travelers: number;
  startDate: Date | string | null;
  travelType: string;
};

export type ProposalAgency = {
  name: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  /** Free-text terms & conditions / cancellation policy. */
  terms?: string | null;
};

export type ProposalMeta = {
  version?: number;
  /** ISO date the proposal was prepared — drives the validity line. */
  preparedAt?: string | null;
  /** Days the quoted price holds. Defaults to 14. */
  validityDays?: number;
};

function fmtFull(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDayLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function PreviewRenderer({
  trip,
  itinerary,
  pricing,
  segments = [],
  agency,
  meta,
}: {
  trip: Trip;
  itinerary: ItineraryContent | null;
  pricing: ProposalPricing | null;
  segments?: TravelSegment[];
  agency?: ProposalAgency | null;
  meta?: ProposalMeta;
}) {
  // Normalize legacy itinerary shapes transparently.
  const normalized: ItineraryContent | null = itinerary
    ? { ...itinerary, days: itinerary.days.map((d) => readDay(d)) }
    : null;

  const startDate = trip.startDate ? new Date(trip.startDate) : null;
  const agencyName = agency?.name?.trim() || "TripCraft";

  // Aggregate per-day inclusions / exclusions into one trip-level list.
  const { included, excluded } = collectInclusions(normalized);

  return (
    <div className="space-y-16 md:space-y-20 print:space-y-10">
      <Hero
        trip={trip}
        startDate={startDate}
        summary={normalized?.summary}
        coverImageUrl={normalized?.coverImageUrl ?? null}
        agencyName={agencyName}
        version={meta?.version}
      />

      {normalized && normalized.days.length > 0 && (
        <AtAGlance itinerary={normalized} startDate={startDate} />
      )}

      {segments.length > 0 && <TravelPlan segments={segments} />}

      {normalized && <Itinerary itinerary={normalized} startDate={startDate} />}

      {(included.length > 0 || excluded.length > 0) && (
        <InclusionSummary included={included} excluded={excluded} />
      )}

      {pricing && <PricingBlock pricing={pricing} meta={meta} />}

      {agency?.terms?.trim() ? <TermsBlock terms={agency.terms} /> : null}

      <ClosingBlock agency={agency} agencyName={agencyName} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero({
  trip,
  startDate,
  summary,
  coverImageUrl,
  agencyName,
  version,
}: {
  trip: Trip;
  startDate: Date | null;
  summary?: string;
  coverImageUrl?: string | null;
  agencyName: string;
  version?: number;
}) {
  const hasCover = !!coverImageUrl;
  const endDate = startDate ? addDays(startDate, trip.days - 1) : null;
  const dateValue =
    startDate && endDate
      ? `${startDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })} – ${fmtFull(endDate)}`
      : "Dates flexible";

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl bg-navy text-ivory print:rounded-none"
    >
      {hasCover && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${coverImageUrl})` }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-navy/90 via-navy/65 to-navy/45"
            aria-hidden
          />
        </>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,106,0.18),transparent_60%)]" />
      <div className="relative px-8 py-14 md:px-16 md:py-20">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-sand">
            Travel proposal · prepared by {agencyName}
          </p>
          {version ? (
            <span className="text-[10px] uppercase tracking-[0.2em] text-ivory/50">
              v{version}
            </span>
          ) : null}
        </div>

        <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
          {trip.destination}
        </h1>
        <p className="mt-6 max-w-2xl text-ivory/75 text-base md:text-lg leading-relaxed">
          {summary?.trim()
            ? summary
            : `A ${trip.days}-day ${trip.travelType.toLowerCase()} journey, curated for ${
                trip.travelers === 1
                  ? "a solo traveller"
                  : `${trip.travelers} travellers`
              }.`}
        </p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl">
          <Meta
            icon={<CalendarDays className="h-4 w-4" />}
            label="Duration"
            value={`${trip.days} days / ${Math.max(0, trip.days - 1)} nights`}
          />
          <Meta
            icon={<Map className="h-4 w-4" />}
            label="Travel dates"
            value={dateValue}
          />
          <Meta
            icon={<Users className="h-4 w-4" />}
            label="Travellers"
            value={`${trip.travelers}`}
          />
          <Meta
            icon={<Compass className="h-4 w-4" />}
            label="Style"
            value={trip.travelType}
          />
        </div>
      </div>
    </motion.section>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sand">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-lg text-ivory leading-snug">
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------

function AtAGlance({
  itinerary,
  startDate,
}: {
  itinerary: ItineraryContent;
  startDate: Date | null;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="rounded-3xl border border-line bg-white p-6 md:p-10 shadow-soft print:break-inside-avoid"
    >
      <p className="text-[11px] uppercase tracking-[0.25em] text-sand-700 mb-5 text-center">
        Trip at a glance
      </p>
      <div className="overflow-x-auto -mx-2 md:mx-0">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-line">
              <th className="pb-3 px-2 font-medium w-28">Day</th>
              <th className="pb-3 px-2 font-medium">Where</th>
              <th className="pb-3 px-2 font-medium">Stay</th>
              <th className="pb-3 px-2 font-medium">Highlights</th>
            </tr>
          </thead>
          <tbody>
            {itinerary.days.map((day, i) => (
              <tr key={i} className="border-b border-line/50 last:border-0">
                <td className="py-3 px-2 align-top">
                  <span className="text-sand-700 font-medium tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {startDate ? (
                    <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {fmtDayLabel(addDays(startDate, i))}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 px-2 text-navy align-top">
                  {day.city || stripDayPrefix(day.title) || "—"}
                </td>
                <td className="py-3 px-2 text-ink/80 text-sm align-top">
                  {day.hotel ? (
                    <>
                      {day.hotel}
                      {day.mealPlan && (
                        <span className="text-muted-foreground">
                          {" · "}
                          {day.mealPlan}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 px-2 text-ink/80 text-sm align-top">
                  {day.activities && day.activities.length > 0 ? (
                    day.activities.slice(0, 3).join(" · ")
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Travel plan
// ---------------------------------------------------------------------------

function TravelPlan({ segments }: { segments: TravelSegment[] }) {
  const flights = segments.filter((s) => s.type === "FLIGHT");
  const trains = segments.filter((s) => s.type === "TRAIN");

  return (
    <section className="space-y-10">
      <SectionHeading eyebrow="Getting there" title="Travel plan" />
      <div className="grid gap-6 md:grid-cols-2 print:grid-cols-2">
        {flights.length > 0 && (
          <SegmentGroup
            title="Flights"
            icon={<Plane className="h-3.5 w-3.5" />}
            segments={flights}
          />
        )}
        {trains.length > 0 && (
          <SegmentGroup
            title="Trains"
            icon={<Train className="h-3.5 w-3.5" />}
            segments={trains}
          />
        )}
      </div>
    </section>
  );
}

function SegmentGroup({
  title,
  icon,
  segments,
}: {
  title: string;
  icon: React.ReactNode;
  segments: TravelSegment[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6 }}
      className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-soft print:break-inside-avoid"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-sand-700 flex items-center gap-2 mb-5">
        {icon}
        {title}
      </p>
      <ul className="space-y-5">
        {segments.map((s) => (
          <SegmentLine key={s.id} segment={s} />
        ))}
      </ul>
    </motion.div>
  );
}

function SegmentLine({ segment }: { segment: TravelSegment }) {
  const isFlight = segment.type === "FLIGHT";
  const identifier = isFlight
    ? [segment.airline, segment.flightNumber].filter(Boolean).join(" · ")
    : [segment.trainName, segment.trainNumber].filter(Boolean).join(" · ");
  const seatLine = !isFlight
    ? [
        segment.coach && `Coach ${segment.coach}`,
        segment.seat && `Seat ${segment.seat}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const dep = new Date(segment.departureTime);
  const arr = new Date(segment.arrivalTime);

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-navy">
          {segment.from} <span className="text-sand-700">→</span> {segment.to}
        </p>
        <span className="text-[10px] uppercase tracking-[0.2em] text-sand-600 whitespace-nowrap">
          Day {segment.dayNumber}
        </span>
      </div>
      {identifier && <p className="mt-0.5 text-sm text-ink/80">{identifier}</p>}
      <p className="mt-1 text-sm tabular-nums text-ink/75">
        {dep.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        {" · "}
        {dep.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
        <span className="text-muted-foreground"> → </span>
        {arr.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </p>
      {seatLine && (
        <p className="mt-0.5 text-xs text-muted-foreground">{seatLine}</p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Day by day
// ---------------------------------------------------------------------------

function Itinerary({
  itinerary,
  startDate,
}: {
  itinerary: ItineraryContent;
  startDate: Date | null;
}) {
  return (
    <section className="space-y-12">
      <SectionHeading eyebrow="The journey" title="Day by day" />
      <div className="space-y-12">
        {itinerary.days.map((day, i) => (
          <DayBlock key={i} day={day} index={i} startDate={startDate} />
        ))}
      </div>
    </section>
  );
}

function DayBlock({
  day,
  index,
  startDate,
}: {
  day: ItineraryDay;
  index: number;
  startDate: Date | null;
}) {
  const foodText = day.foodNote?.trim() || day.food?.trim() || null;
  const dateLabel = startDate ? fmtDayLabel(addDays(startDate, index)) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="grid md:grid-cols-[200px_1fr] gap-6 md:gap-12 print:break-inside-avoid"
    >
      <div className="md:border-r md:border-line md:pr-6">
        <p className="text-xs uppercase tracking-[0.25em] text-sand-600">
          Day {index + 1}
        </p>
        {dateLabel && (
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
            {dateLabel}
          </p>
        )}
        <h3 className="mt-3 font-display text-2xl text-navy leading-tight">
          {stripDayPrefix(day.title)}
        </h3>
        {day.city && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink/70">
            <MapPin className="h-3 w-3 text-sand-700" />
            {day.city}
          </p>
        )}
        {day.meals && hasAnyMeal(day.meals) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {day.meals.breakfast && <MealChip label="Breakfast" />}
            {day.meals.lunch && <MealChip label="Lunch" />}
            {day.meals.dinner && <MealChip label="Dinner" />}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {day.imageUrl && (
          <div
            className="h-48 md:h-56 w-full rounded-2xl bg-cover bg-center border border-line print:break-inside-avoid"
            style={{ backgroundImage: `url(${day.imageUrl})` }}
            aria-hidden
          />
        )}
        {(day.hotel || day.mealPlan) && <StayCard day={day} />}

        {day.summary?.trim() && (
          <p className="text-ink/85 text-base md:text-[17px] leading-relaxed whitespace-pre-line">
            {day.summary.trim()}
          </p>
        )}

        {day.activities && day.activities.length > 0 && (
          <ActivitiesBlock activities={day.activities} />
        )}

        {foodText && (
          <Callout
            icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
            label="Dining"
            text={foodText}
          />
        )}

        {((day.inclusions && day.inclusions.length > 0) ||
          (day.exclusions && day.exclusions.length > 0)) && (
          <InclusionsExclusions day={day} />
        )}

        {day.transferNote?.trim() && (
          <Callout
            icon={<Map className="h-3.5 w-3.5" />}
            label="Transfer"
            text={day.transferNote}
            tone="ivory"
          />
        )}

        {day.notes?.trim() && (
          <Callout
            icon={<Compass className="h-3.5 w-3.5" />}
            label="Good to know"
            text={day.notes}
            tone="ivory"
          />
        )}
      </div>
    </motion.article>
  );
}

function ActivitiesBlock({ activities }: { activities: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-sand-700 mb-3 inline-flex items-center gap-1.5">
        <Map className="h-3 w-3" />
        Experiences & highlights
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {activities.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
            <span className="mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-sand-400" />
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
      {label}
    </span>
  );
}

function hasAnyMeal(m: {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
}) {
  return !!(m.breakfast || m.lunch || m.dinner);
}

function StayCard({ day }: { day: ItineraryDay }) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-sand-50/50 px-5 py-4 flex items-start gap-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-sand-200 text-sand-700 flex-shrink-0">
        <Building2 className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        {day.hotel && (
          <p className="font-medium text-navy">
            {day.hotel}
            {day.roomType && (
              <span className="text-ink/70 font-normal"> · {day.roomType}</span>
            )}
          </p>
        )}
        {day.mealPlan && (
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Utensils className="h-3 w-3" />
            {day.mealPlan}
          </p>
        )}
      </div>
    </div>
  );
}

function InclusionsExclusions({ day }: { day: ItineraryDay }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
      {day.inclusions && day.inclusions.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-800 mb-2">
            Included this day
          </p>
          <ul className="space-y-1">
            {day.inclusions.map((it, i) => (
              <li
                key={i}
                className="text-sm text-ink/85 flex items-start gap-1.5"
              >
                <Check className="h-3 w-3 text-emerald-600 mt-1 flex-shrink-0" />
                {it}
              </li>
            ))}
          </ul>
        </div>
      )}
      {day.exclusions && day.exclusions.length > 0 && (
        <div className="rounded-xl border border-line bg-ivory/60 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Not included
          </p>
          <ul className="space-y-1">
            {day.exclusions.map((it, i) => (
              <li
                key={i}
                className="text-sm text-ink/75 flex items-start gap-1.5"
              >
                <X className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                {it}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip-level inclusion summary
// ---------------------------------------------------------------------------

function collectInclusions(itinerary: ItineraryContent | null): {
  included: string[];
  excluded: string[];
} {
  if (!itinerary) return { included: [], excluded: [] };
  const dedupe = (lists: (string[] | undefined)[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const list of lists) {
      for (const raw of list ?? []) {
        const v = raw.trim();
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(v);
      }
    }
    return out;
  };
  return {
    included: dedupe(itinerary.days.map((d) => d.inclusions)),
    excluded: dedupe(itinerary.days.map((d) => d.exclusions)),
  };
}

function InclusionSummary({
  included,
  excluded,
}: {
  included: string[];
  excluded: string[];
}) {
  return (
    <section className="space-y-10 print:break-inside-avoid">
      <SectionHeading eyebrow="The fine print" title="What's included" />
      <div className="grid gap-6 md:grid-cols-2">
        {included.length > 0 && (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/40 p-6 md:p-8">
            <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-800 mb-4 inline-flex items-center gap-2">
              <Check className="h-3.5 w-3.5" />
              Your package includes
            </p>
            <ul className="space-y-2">
              {included.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-ink/85"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        )}
        {excluded.length > 0 && (
          <div className="rounded-3xl border border-line bg-white p-6 md:p-8 shadow-soft">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4 inline-flex items-center gap-2">
              <X className="h-3.5 w-3.5" />
              Not included
            </p>
            <ul className="space-y-2">
              {excluded.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-ink/75"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  {it}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pricing — customer-safe: selling prices only, no markup / cost math.
// ---------------------------------------------------------------------------

function PricingBlock({
  pricing,
  meta,
}: {
  pricing: ProposalPricing;
  meta?: ProposalMeta;
}) {
  const validityDays = meta?.validityDays ?? 14;
  const validUntil = meta?.preparedAt
    ? addDays(new Date(meta.preparedAt), validityDays)
    : null;

  return (
    <section className="space-y-10 print:break-before-page">
      <SectionHeading eyebrow="Investment" title="Your package price" />

      <div className="rounded-3xl border border-line bg-white shadow-soft overflow-hidden">
        {/* Headline price */}
        <div className="bg-navy text-ivory px-8 py-10 md:px-12 text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] text-sand">
            Total package
          </p>
          <p className="mt-2 font-display text-5xl md:text-6xl tracking-tight">
            {formatINR(pricing.total)}
          </p>
          {pricing.travelers > 1 && (
            <p className="mt-3 text-sm text-ivory/70">
              {formatINR(pricing.perPerson)} per person ·{" "}
              {pricing.travelers} travellers
            </p>
          )}
        </div>

        {/* Category breakdown — selling amounts, summing to the total */}
        {pricing.categories.length > 0 && (
          <div className="px-8 py-8 md:px-12">
            <p className="text-[11px] uppercase tracking-[0.22em] text-sand-700 mb-4">
              How it breaks down
            </p>
            <ul className="divide-y divide-line/70">
              {pricing.categories.map((c) => (
                <li
                  key={c.category}
                  className="flex items-baseline justify-between gap-4 py-3"
                >
                  <span className="text-ink">{c.label}</span>
                  <span className="tabular-nums text-navy font-medium">
                    {formatINR(c.amount)}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-4 pt-4">
                <span className="text-xs uppercase tracking-[0.2em] text-navy">
                  Total
                </span>
                <span className="font-display text-2xl text-navy">
                  {formatINR(pricing.total)}
                </span>
              </li>
            </ul>
            <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
              All amounts are in Indian Rupees and inclusive of applicable
              service charges.
              {validUntil
                ? ` This quotation is valid until ${fmtFull(validUntil)}.`
                : ""}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

function TermsBlock({ terms }: { terms: string }) {
  return (
    <section className="print:break-inside-avoid">
      <div className="rounded-3xl border border-line bg-ivory/60 p-6 md:p-8">
        <p className="text-[11px] uppercase tracking-[0.22em] text-sand-700 mb-3 inline-flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          Booking terms & conditions
        </p>
        <p className="text-sm text-ink/75 leading-relaxed whitespace-pre-line">
          {terms}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Closing — white-label, agency-branded
// ---------------------------------------------------------------------------

function ClosingBlock({
  agency,
  agencyName,
}: {
  agency?: ProposalAgency | null;
  agencyName: string;
}) {
  const contacts: { icon: React.ReactNode; value: string }[] = [];
  if (agency?.phone)
    contacts.push({
      icon: <Phone className="h-3.5 w-3.5" />,
      value: agency.phone,
    });
  if (agency?.email)
    contacts.push({
      icon: <Mail className="h-3.5 w-3.5" />,
      value: agency.email,
    });
  if (agency?.website)
    contacts.push({
      icon: <Compass className="h-3.5 w-3.5" />,
      value: agency.website,
    });

  return (
    <section className="text-center pt-10 border-t border-line print:break-inside-avoid">
      <p className="text-[11px] uppercase tracking-[0.25em] text-sand-700">
        Ready when you are
      </p>
      <p className="mt-3 font-display text-3xl text-navy">{agencyName}</p>
      {contacts.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink/75">
          {contacts.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className="text-sand-700">{c.icon}</span>
              {c.value}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
        Crafted with TripCraft
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function Callout({
  icon,
  label,
  text,
  tone = "white",
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  tone?: "white" | "ivory";
}) {
  return (
    <div
      className={`rounded-xl border border-line px-5 py-4 ${
        tone === "ivory" ? "bg-ivory" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sand-700">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm text-ink/80 leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-4xl md:text-5xl text-navy">
        {title}
      </h2>
    </motion.div>
  );
}

function stripDayPrefix(title: string) {
  return title.replace(/^Day\s*\d+\s*[:\-—]\s*/i, "").trim() || title;
}
