"use client";

import { motion } from "framer-motion";
import {
  Building2,
  Calendar,
  Check,
  Compass,
  Eye,
  Map,
  MapPin,
  Plane,
  Train,
  Users,
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

export type ProposalTheme = "classic" | "editorial" | "minimal";
export type ProposalCoverStyle = "photo" | "gradient" | "solid";

/** Per-agency look + content toggles for the customer-facing proposal. */
export type ProposalBranding = {
  theme?: ProposalTheme;
  /** Hex colour. Falls back to the sand token when null/undefined. */
  accentColor?: string | null;
  coverStyle?: ProposalCoverStyle;
  showAtAGlance?: boolean;
  showInclusions?: boolean;
  showTerms?: boolean;
  signatureNote?: string | null;
  /** Stamp the agency logo on every major section header. */
  repeatLogo?: boolean;
};

type ResolvedBranding = {
  theme: ProposalTheme;
  accent: string; // always a concrete colour, falls back to sand token
  coverStyle: ProposalCoverStyle;
  showAtAGlance: boolean;
  showInclusions: boolean;
  showTerms: boolean;
  signatureNote: string | null;
  repeatLogo: boolean;
};

const SAND_ACCENT = "#C8A96A";
const DEFAULT_TAGLINE = "Crafted travel";

function resolveBranding(b?: ProposalBranding | null): ResolvedBranding {
  return {
    theme: b?.theme ?? "classic",
    accent: b?.accentColor?.trim() || SAND_ACCENT,
    // Minimal forces a flat cover (no photo hero — that's the whole point).
    coverStyle: b?.theme === "minimal" ? "solid" : b?.coverStyle ?? "photo",
    showAtAGlance: b?.showAtAGlance ?? true,
    showInclusions: b?.showInclusions ?? true,
    showTerms: b?.showTerms ?? true,
    signatureNote: b?.signatureNote?.trim() || null,
    repeatLogo: b?.repeatLogo ?? true,
  };
}

/** Monogram "seal" — agency logo if present, else the initial in Playfair. */
function Seal({
  logoUrl,
  agencyName,
  className = "",
  style,
}: {
  logoUrl?: string | null;
  agencyName: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`seal ${className}`} style={style} aria-label={agencyName}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={agencyName} />
      ) : (
        agencyName.charAt(0).toUpperCase()
      )}
    </span>
  );
}

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

function dateRangeOf(startDate: Date | null, days: number): string {
  if (!startDate) return "Dates flexible";
  const end = addDays(startDate, days - 1);
  return `${startDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })} – ${fmtFull(end)}`;
}

export function PreviewRenderer({
  trip,
  itinerary,
  pricing,
  segments = [],
  agency,
  meta,
  branding,
  recipientName,
}: {
  trip: Trip;
  itinerary: ItineraryContent | null;
  pricing: ProposalPricing | null;
  segments?: TravelSegment[];
  agency?: ProposalAgency | null;
  meta?: ProposalMeta;
  branding?: ProposalBranding | null;
  /** "Prepared for {name}" on the cover — optional. */
  recipientName?: string | null;
}) {
  const normalized: ItineraryContent | null = itinerary
    ? { ...itinerary, days: itinerary.days.map((d) => readDay(d)) }
    : null;

  const startDate = trip.startDate ? new Date(trip.startDate) : null;
  const agencyName = agency?.name?.trim() || "TripCraft";
  const b = resolveBranding(branding);
  const logoUrl = agency?.logoUrl ?? null;

  const { included, excluded } = collectInclusions(normalized);

  const accentStyle = {
    ["--proposal-accent" as string]: b.accent,
  } as React.CSSProperties;

  return (
    <div className="pp" data-theme={b.theme} style={accentStyle}>
      <Cover
        trip={trip}
        startDate={startDate}
        coverImageUrl={normalized?.coverImageUrl ?? null}
        agencyName={agencyName}
        logoUrl={logoUrl}
        version={meta?.version}
        branding={b}
        recipientName={recipientName ?? null}
      />

      <Overview
        trip={trip}
        summary={normalized?.summary}
        itinerary={normalized}
        agencyName={agencyName}
        logoUrl={logoUrl}
        showIndex={b.showAtAGlance}
        validityDays={meta?.validityDays ?? 14}
      />

      {segments.length > 0 && (
        <GettingThere segments={segments} />
      )}

      {normalized && normalized.days.length > 0 && (
        <DayByDay itinerary={normalized} startDate={startDate} />
      )}

      {b.showInclusions && (included.length > 0 || excluded.length > 0) && (
        <Inclusions included={included} excluded={excluded} />
      )}

      {pricing && <Investment pricing={pricing} meta={meta} />}

      {b.showTerms && agency?.terms?.trim() ? (
        <Terms terms={agency.terms} />
      ) : null}

      <Closing
        agency={agency}
        agencyName={agencyName}
        logoUrl={logoUrl}
        signatureNote={b.signatureNote}
      />
    </div>
  );
}

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function Cover({
  trip,
  startDate,
  coverImageUrl,
  agencyName,
  logoUrl,
  version,
  branding,
  recipientName,
}: {
  trip: Trip;
  startDate: Date | null;
  coverImageUrl: string | null;
  agencyName: string;
  logoUrl: string | null;
  version?: number;
  branding: ResolvedBranding;
  recipientName: string | null;
}) {
  const hasCover = !!coverImageUrl && branding.coverStyle === "photo";
  const range = dateRangeOf(startDate, trip.days);

  return (
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="pp-cover"
    >
      {hasCover && (
        // Real <img> (not a CSS bg) so it survives "Save as PDF".
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverImageUrl!} alt="" className="cover-img" aria-hidden />
      )}
      <div className="scrim" />
      <div className="glow" />
      <div className="pp-cover-inner">
        <div className="cover-top">
          <div className="cover-brand">
            <Seal
              logoUrl={logoUrl}
              agencyName={agencyName}
              style={{
                width: 44,
                height: 44,
                fontSize: 16,
                background: "rgba(255,255,255,.05)",
              }}
            />
            <div>
              <div className="cover-word">{agencyName.toUpperCase()}</div>
              <div className="cover-tag">{DEFAULT_TAGLINE}</div>
            </div>
          </div>
          <div className="cover-vrow">
            <div className="l">Travel Proposal</div>
            <div className="v">
              {version ? `v${version} · ` : ""}
              {range}
            </div>
          </div>
        </div>

        <div className="cover-headline">
          <div className="cover-kicker">
            A journey for {trip.travelers}
          </div>
          <div className="cover-title">{trip.destination}</div>
          <div className="cover-sub">
            A {trip.days}-day {trip.travelType.toLowerCase()} journey, crafted
            with care from first light to last sunset.
          </div>
          {recipientName ? (
            <div className="cover-prepared">
              Prepared for <b>{recipientName}</b>
            </div>
          ) : null}

          <div className="cover-meta">
            <div className="cmeta">
              <div className="l">
                <Calendar /> Duration
              </div>
              <div className="v">
                {trip.days}
                <small> days</small> / {Math.max(0, trip.days - 1)}
                <small> nights</small>
              </div>
            </div>
            <div className="cmeta">
              <div className="l">
                <MapPin /> Travel dates
              </div>
              <div className="v">{range}</div>
            </div>
            <div className="cmeta">
              <div className="l">
                <Users /> Travellers
              </div>
              <div className="v">
                {trip.travelers}
                <small> guests</small>
              </div>
            </div>
            <div className="cmeta">
              <div className="l">
                <Compass /> Style
              </div>
              <div className="v">{trip.travelType}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

// ---------------------------------------------------------------------------
// Overview — drop-cap lead + dotted itinerary index
// ---------------------------------------------------------------------------

function Overview({
  trip,
  summary,
  itinerary,
  agencyName,
  logoUrl,
  showIndex,
  validityDays,
}: {
  trip: Trip;
  summary?: string;
  itinerary: ItineraryContent | null;
  agencyName: string;
  logoUrl: string | null;
  showIndex: boolean;
  validityDays: number;
}) {
  const lead =
    summary?.trim() ||
    `A ${trip.days}-day ${trip.travelType.toLowerCase()} journey across ${
      trip.destination
    } — every stay hand-picked, every transfer private, nothing rushed.`;
  const hasIndex = showIndex && itinerary && itinerary.days.length > 0;

  return (
    <motion.section {...reveal} className="pp-sec">
      <div className="sec-kicker">
        <span className="eyb gold">The Overview</span>
        <span className="ln" />
        <Seal
          logoUrl={logoUrl}
          agencyName={agencyName}
          className="on-light"
          style={{ width: 30, height: 30, fontSize: 12 }}
        />
      </div>
      <div className={hasIndex ? "ov-grid" : ""}>
        <div>
          <p className="ov-lead">{lead}</p>
          <p className="ov-note">
            This itinerary is fully bespoke and can be tuned to your pace — add
            a day, soften the early starts, or upgrade a suite. Pricing on the
            final pages holds for {validityDays} days from issue.
          </p>
        </div>
        {hasIndex && (
          <div>
            <div className="eyb" style={{ marginBottom: 16 }}>
              The Itinerary
            </div>
            <div className="ov-index">
              {itinerary!.days.map((d, i) => (
                <div className="ov-row" key={i}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="place">
                    {d.city || stripDayPrefix(d.title) || `Day ${i + 1}`}
                  </span>
                  <span className="dots" />
                  <span className="stay">{d.hotel || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Getting there (travel segments)
// ---------------------------------------------------------------------------

function GettingThere({ segments }: { segments: TravelSegment[] }) {
  const flights = segments.filter((s) => s.type === "FLIGHT");
  const trains = segments.filter((s) => s.type === "TRAIN");
  return (
    <motion.section {...reveal} className="pp-sec tight">
      <div className="sec-kicker">
        <span className="eyb gold">Getting There</span>
        <span className="ln" />
      </div>
      <div className="inc-grid">
        {flights.length > 0 && (
          <SegmentGroup
            title="Flights"
            icon={<Plane />}
            segments={flights}
          />
        )}
        {trains.length > 0 && (
          <SegmentGroup title="Trains" icon={<Train />} segments={trains} />
        )}
      </div>
    </motion.section>
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
  const time = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <div>
      <div className="exp-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        {title}
      </div>
      <div className="exp-list">
        {segments.map((s) => {
          const isFlight = s.type === "FLIGHT";
          const id = isFlight
            ? [s.airline, s.flightNumber].filter(Boolean).join(" · ")
            : [s.trainName, s.trainNumber].filter(Boolean).join(" · ");
          const dep = new Date(s.departureTime);
          const arr = new Date(s.arrivalTime);
          return (
            <div key={s.id} style={{ paddingBottom: 8 }}>
              <div className="day-title" style={{ fontSize: 18 }}>
                {s.from} <span style={{ color: "var(--gold-deep)" }}>→</span>{" "}
                {s.to}
              </div>
              {id ? (
                <div className="day-pin" style={{ marginTop: 6 }}>
                  {id}
                </div>
              ) : null}
              <div
                className="ppmono"
                style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}
              >
                Day {s.dayNumber} ·{" "}
                {dep.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {time(dep)} → {time(arr)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day by day
// ---------------------------------------------------------------------------

function DayByDay({
  itinerary,
  startDate,
}: {
  itinerary: ItineraryContent;
  startDate: Date | null;
}) {
  return (
    <section className="pp-sec" style={{ background: "var(--paper)" }}>
      <div className="sec-kicker">
        <span className="eyb gold">The Journey</span>
        <span className="ln" />
      </div>
      <h2 className="sec-h" style={{ marginBottom: 8 }}>
        Day by day
      </h2>
      <div style={{ marginTop: 16 }}>
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
  const rawFood = day.foodNote?.trim() || day.food?.trim() || null;
  const foodText = isGenericMealNote(rawFood) ? null : rawFood;
  const dateLabel = startDate ? fmtDayLabel(addDays(startDate, index)) : null;
  const activities = day.activities ?? [];
  const showPhoto = !!day.imageUrl;
  // Striped placeholder reads as a deliberate location slot — only on days
  // that have real content, never on a bare arrival/departure leg.
  const showPlaceholder = !day.imageUrl && activities.length >= 2;

  return (
    <motion.article {...reveal} className="day">
      <div className="day-rail">
        <div className="day-num">{String(index + 1).padStart(2, "0")}</div>
        {dateLabel && <div className="day-date">{dateLabel}</div>}
        {day.city && (
          <div className="day-pin">
            <MapPin /> {day.city}
          </div>
        )}
        {day.meals && hasAnyMeal(day.meals) && (
          <div className="day-meals">
            {day.meals.breakfast && <span className="mchip">Breakfast</span>}
            {day.meals.lunch && <span className="mchip">Lunch</span>}
            {day.meals.dinner && <span className="mchip">Dinner</span>}
          </div>
        )}
      </div>
      <div className="day-body">
        <h3 className="day-title">{stripDayPrefix(day.title)}</h3>
        {day.summary?.trim() && <p className="day-text">{day.summary.trim()}</p>}

        {showPhoto && (
          <>
            <div className="day-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={day.imageUrl!} alt={day.title} />
            </div>
            {day.city && <div className="day-cap">{day.city}</div>}
          </>
        )}
        {showPlaceholder && (
          <div className="day-img ph">
            <div className="img-ph">
              <Eye />
              <span>Photo{day.city ? ` · ${day.city}` : ""}</span>
            </div>
          </div>
        )}

        {activities.length > 0 && (
          <div className="exp">
            <div className="exp-h">Experiences &amp; highlights</div>
            <div className="exp-list">
              {activities.map((e, i) => (
                <div className="exp-item" key={i}>
                  <span className="bull" />
                  {e}
                </div>
              ))}
            </div>
          </div>
        )}

        {day.hotel && (
          <div className="stay-card">
            <span className="ic">
              <Building2 />
            </span>
            <div>
              <div className="l">Where you&apos;ll stay</div>
              <div className="v">
                {day.hotel}
                {day.roomType && <small> · {day.roomType}</small>}
              </div>
            </div>
          </div>
        )}

        {foodText && (
          <div className="callout">
            <div className="ch">
              <UtensilsCrossed /> Dining
            </div>
            <p>{foodText}</p>
          </div>
        )}
        {day.transferNote?.trim() && (
          <div className="callout ivory">
            <div className="ch">
              <Map /> Transfer
            </div>
            <p>{day.transferNote.trim()}</p>
          </div>
        )}
        {day.notes?.trim() && (
          <div className="callout ivory">
            <div className="ch">
              <Compass /> Good to know
            </div>
            <p>{day.notes.trim()}</p>
          </div>
        )}
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Inclusions
// ---------------------------------------------------------------------------

function Inclusions({
  included,
  excluded,
}: {
  included: string[];
  excluded: string[];
}) {
  return (
    <motion.section {...reveal} className="pp-sec">
      <div className="sec-kicker">
        <span className="eyb gold">The Fine Print</span>
        <span className="ln" />
      </div>
      <h2 className="sec-h" style={{ marginBottom: 36 }}>
        What&apos;s included
      </h2>
      <div className="inc-grid">
        {included.length > 0 && (
          <div>
            <div className="inc-h in">Your package includes</div>
            {included.map((it, i) => (
              <div className="inc-item in" key={i}>
                <Check /> {it}
              </div>
            ))}
          </div>
        )}
        {excluded.length > 0 && (
          <div>
            <div className="inc-h ex">Not included</div>
            {excluded.map((it, i) => (
              <div className="inc-item ex" key={i}>
                <X /> {it}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Investment — customer-safe: selling totals only, no cost/markup/profit.
// ---------------------------------------------------------------------------

function Investment({
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
    <motion.section
      {...reveal}
      className="pp-sec pp-invest"
      style={{ scrollMarginTop: 40 }}
    >
      <div className="glow" />
      <div className="invest-grid">
        <div>
          <div className="invest-eyb">The Investment</div>
          <div className="invest-total">{formatINR(pricing.total)}</div>
          {pricing.travelers > 1 && (
            <div className="invest-pp">
              {formatINR(pricing.perPerson)} per person · {pricing.travelers}{" "}
              travellers
            </div>
          )}
          <p className="invest-valid">
            All amounts in Indian Rupees, inclusive of applicable service
            charges.
            {validUntil
              ? ` This quotation is valid until ${fmtFull(validUntil)}.`
              : ""}
          </p>
        </div>
        {pricing.categories.length > 0 && (
          <div className="invest-break">
            <div className="brk-h">How it breaks down</div>
            {pricing.categories.map((c) => (
              <div className="brk-row" key={c.category}>
                <span className="c">{c.label}</span>
                <span className="a">{formatINR(c.amount)}</span>
              </div>
            ))}
            <div className="brk-total">
              <span className="c">Total package</span>
              <span className="a">{formatINR(pricing.total)}</span>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

function Terms({ terms }: { terms: string }) {
  return (
    <motion.section {...reveal} className="pp-sec tight">
      <div className="sec-kicker">
        <span className="eyb">Booking Terms</span>
        <span className="ln" />
      </div>
      <div className="terms-box">
        <p className="terms-body">{terms}</p>
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

function Closing({
  agency,
  agencyName,
  logoUrl,
  signatureNote,
}: {
  agency?: ProposalAgency | null;
  agencyName: string;
  logoUrl: string | null;
  signatureNote: string | null;
}) {
  const contacts: { label: string; value: string }[] = [];
  if (agency?.phone) contacts.push({ label: "Phone", value: agency.phone });
  if (agency?.email) contacts.push({ label: "Email", value: agency.email });
  if (agency?.website) contacts.push({ label: "Web", value: agency.website });

  return (
    <footer className="pp-close">
      <div className="glow" />
      <div className="ci">
        <Seal logoUrl={logoUrl} agencyName={agencyName} />
        <p className="close-sig">
          {signatureNote ??
            "When you're ready, we'll handle every detail — so all that's left for you is to arrive."}
        </p>
        <div style={{ marginTop: 26 }}>
          <div className="close-eyb">With warm regards</div>
          <div className="close-agency">{agencyName}</div>
        </div>
        {contacts.length > 0 && (
          <div className="close-contacts">
            {contacts.map((c, i) => (
              <div key={i}>
                <div className="l">{c.label}</div>
                <div className="v">{c.value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="close-craft">Crafted with TripCraft</div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
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

function hasAnyMeal(m: {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
}) {
  return !!(m.breakfast || m.lunch || m.dinner);
}

/**
 * True when a foodNote is just a generic restatement of which meals are
 * included — the meal chips already convey it. A genuine recommendation
 * like "Try the duck at Mozaic" survives.
 */
function isGenericMealNote(note: string | null): boolean {
  if (!note) return false;
  const remainder = note
    .toLowerCase()
    .replace(
      /breakfast|lunch|dinner|supper|\bmeal[s]?\s*plan\b|\bmeal[s]?\b|will be (?:provided|served)|included|provided|served|at (?:the )?hotel|\band\b|\bthe\b|\bare\b|\bis\b|\ball\b|\bboth\b/g,
      ""
    )
    .replace(/[\s.,;:()\-+&/]/g, "");
  return remainder.length < 4;
}

function stripDayPrefix(title: string) {
  return title.replace(/^Day\s*\d+\s*[:\-—]\s*/i, "").trim() || title;
}
