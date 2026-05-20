"use client";

import { motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  Check,
  Compass,
  Map,
  MapPin,
  Plane,
  Train,
  Users,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { TravelSegment } from "@prisma/client";
import {
  readDay,
  type ItineraryContent,
  type ItineraryDay,
} from "@/lib/ai";
import type { PricingItem } from "@/types";
import { formatDate, formatINR } from "@/lib/utils";

type Trip = {
  destination: string;
  days: number;
  travelers: number;
  startDate: Date | string | null;
  travelType: string;
};

type Pricing = {
  items: PricingItem[];
  markupPct: number;
  discountPct?: number;
  markupAmount?: number;
  discountAmount?: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  version?: number;
  status?: string;
} | null;

export function PreviewRenderer({
  trip,
  itinerary,
  pricing,
  segments = [],
}: {
  trip: Trip;
  itinerary: ItineraryContent | null;
  pricing: Pricing;
  segments?: TravelSegment[];
}) {
  // Normalize all days to the modern shape — handles legacy itineraries
  // (morning/afternoon/evening / sights / freeform food) transparently.
  const normalized: ItineraryContent | null = itinerary
    ? { ...itinerary, days: itinerary.days.map((d) => readDay(d)) }
    : null;

  return (
    <div className="space-y-20 print:space-y-10">
      <Hero
        trip={trip}
        summary={normalized?.summary}
        coverImageUrl={normalized?.coverImageUrl ?? null}
      />
      {normalized && normalized.days.length > 0 && (
        <AtAGlance itinerary={normalized} />
      )}
      {segments.length > 0 && <TravelPlan segments={segments} />}
      {normalized && <Itinerary itinerary={normalized} />}
      {pricing && <PricingBlock pricing={pricing} />}
      <Footer />
    </div>
  );
}

function AtAGlance({ itinerary }: { itinerary: ItineraryContent }) {
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
              <th className="pb-3 px-2 font-medium w-16">Day</th>
              <th className="pb-3 px-2 font-medium">Where</th>
              <th className="pb-3 px-2 font-medium">Stay</th>
              <th className="pb-3 px-2 font-medium">Highlights</th>
            </tr>
          </thead>
          <tbody>
            {itinerary.days.map((day, i) => (
              <tr key={i} className="border-b border-line/50 last:border-0">
                <td className="py-3 px-2 text-sand-700 font-medium tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="py-3 px-2 text-navy">
                  {day.city || stripDayPrefix(day.title) || "—"}
                </td>
                <td className="py-3 px-2 text-ink/80 text-sm">
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
                <td className="py-3 px-2 text-ink/80 text-sm">
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

function TravelPlan({ segments }: { segments: TravelSegment[] }) {
  const flights = segments.filter((s) => s.type === "FLIGHT");
  const trains = segments.filter((s) => s.type === "TRAIN");

  return (
    <section className="space-y-12">
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
      {identifier && (
        <p className="mt-0.5 text-sm text-ink/80">{identifier}</p>
      )}
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

function Hero({
  trip,
  summary,
  coverImageUrl,
}: {
  trip: Trip;
  summary?: string;
  coverImageUrl?: string | null;
}) {
  const hasCover = !!coverImageUrl;
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl bg-navy text-ivory print:rounded-none"
    >
      {hasCover && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${coverImageUrl})` }}
          aria-hidden
        />
      )}
      {hasCover && (
        <div
          className="absolute inset-0 bg-gradient-to-br from-navy/85 via-navy/60 to-navy/40"
          aria-hidden
        />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,106,0.18),transparent_60%)]" />
      <div className="relative px-8 py-16 md:px-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.3em] text-sand">
          A bespoke proposal
        </p>
        <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[0.95] tracking-tight">
          {trip.destination}
        </h1>
        <p className="mt-6 max-w-2xl text-ivory/75 text-lg leading-relaxed">
          {summary?.trim()
            ? summary
            : `A ${trip.days}-day ${trip.travelType.toLowerCase()} journey curated for ${
                trip.travelers === 1
                  ? "a solo traveler"
                  : `${trip.travelers} travelers`
              }.`}
        </p>

        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-6 max-w-xl">
          <Meta
            icon={<CalendarDays className="h-4 w-4" />}
            label="Duration"
            value={`${trip.days} days`}
          />
          <Meta
            icon={<Users className="h-4 w-4" />}
            label="Travelers"
            value={`${trip.travelers}`}
          />
          <Meta
            icon={<Map className="h-4 w-4" />}
            label="Departure"
            value={trip.startDate ? formatDate(trip.startDate) : "Flexible"}
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
        <span className="text-[10px] uppercase tracking-[0.25em]">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl text-ivory">{value}</p>
    </div>
  );
}

function Itinerary({ itinerary }: { itinerary: ItineraryContent }) {
  return (
    <section className="space-y-12">
      <SectionHeading eyebrow="The Journey" title="Day by day" />
      <div className="space-y-12">
        {itinerary.days.map((day, i) => (
          <DayBlock key={i} day={day} index={i} />
        ))}
      </div>
    </section>
  );
}

function DayBlock({ day, index }: { day: ItineraryDay; index: number }) {
  // Falls back to legacy food string when foodNote isn't filled — keeps old
  // itineraries rendering well.
  const foodText = day.foodNote?.trim() || day.food?.trim() || null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="grid md:grid-cols-[180px_1fr] gap-6 md:gap-12 print:break-inside-avoid"
    >
      <div className="md:border-r md:border-line md:pr-6">
        <p className="text-xs uppercase tracking-[0.25em] text-sand-600">
          Day {index + 1}
        </p>
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
            {day.meals.breakfast && <MealChip label="B" />}
            {day.meals.lunch && <MealChip label="L" />}
            {day.meals.dinner && <MealChip label="D" />}
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
            label="Food highlight"
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
            label="Logistics & insider tips"
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
        Activities & highlights
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {activities.map((a, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-ink/85"
          >
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
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-800">
      {label}
    </span>
  );
}

function hasAnyMeal(m: { breakfast?: boolean; lunch?: boolean; dinner?: boolean }) {
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
            Included
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

function stripDayPrefix(title: string) {
  return title.replace(/^Day\s*\d+\s*[:\-—]\s*/i, "").trim() || title;
}

function PricingBlock({
  pricing,
}: {
  pricing: NonNullable<Pricing>;
}) {
  return (
    <section className="space-y-10 print:break-before-page">
      <SectionHeading eyebrow="Investment" title="Your quotation" />
      <div className="rounded-3xl border border-line bg-white p-8 md:p-12 shadow-soft">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-line">
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium">Detail</th>
              <th className="pb-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {pricing.items.map((it) => (
              <tr key={it.id} className="border-b border-line/60">
                <td className="py-4 text-sm text-sand-700">{it.category}</td>
                <td className="py-4 text-ink">{it.label || "—"}</td>
                <td className="py-4 text-right tabular-nums">
                  {formatINR(it.cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 flex justify-end">
          <div className="w-full max-w-sm space-y-2">
            <Line label="Subtotal" value={formatINR(pricing.totalCost)} />
            <Line
              label={`Service & curation (${pricing.markupPct}%)`}
              value={`+${formatINR(
                pricing.markupAmount ??
                  Math.round(pricing.totalCost * (pricing.markupPct / 100))
              )}`}
            />
            {!!pricing.discountPct && pricing.discountPct > 0 && (
              <Line
                label={`Discount (${pricing.discountPct}%)`}
                value={`−${formatINR(pricing.discountAmount ?? 0)}`}
              />
            )}
            <div className="my-3 h-px bg-line" />
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-navy">
                Total
              </span>
              <span className="font-display text-3xl text-navy">
                {formatINR(pricing.sellingPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
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

function Footer() {
  return (
    <div className="text-center pt-10 border-t border-line">
      <p className="font-display text-2xl text-navy">TripCraft</p>
      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        Curated travel, end to end
      </p>
    </div>
  );
}
