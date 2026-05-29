/* eslint-disable jsx-a11y/alt-text */
// PDF rendering of a travel proposal via @react-pdf/renderer — the "Atelier
// Editorial" treatment, mirroring the customer web proposal
// ([preview-renderer.tsx](src/components/preview-renderer.tsx)) paginated for
// A4. Each agency's theme + accent + logo + section toggles flow through
// [proposal-pdf.ts](src/server/services/proposal-pdf.ts); this file is pure
// presentation. @react-pdf has no gradients / CSS vars / ::after / reliable
// gap — so: explicit values, nested <View>s, Times-Roman for the serif and
// Helvetica for the sans.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ProposalPdfSnapshot } from "@/server/services/proposal-pdf";

// --- design tokens --------------------------------------------------------

const NAVY = "#0C1620";
const IVORY = "#FAF7F0";
const IVORY2 = "#F3EEE2";
const PAPER = "#FFFFFF";
const INK = "#16191D";
const INK2 = "#3C434B";
const MUTED = "#6B7077";
const FAINT = "#9BA0A6";
const LINE = "#E6E2D8";
const ON_DARK = "#EFEAE0";
const OK = "#5C8C69";

// --- helpers --------------------------------------------------------------

function formatINR(n: number): string {
  // "Rs." not the ₹ glyph (U+20B9): @react-pdf's built-in fonts have no rupee
  // glyph, so ₹ renders as a stray "¹". "Rs." is glyph-safe.
  return (
    "Rs. " +
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Math.round(n))
  );
}

function fmtDate(d: Date | string | null | undefined): string {
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

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function stripDayPrefix(t: string): string {
  return t.replace(/^Day\s*\d+\s*[:\-—]\s*/i, "").trim() || t;
}

function hasAnyMealsPdf(
  m?: { breakfast?: boolean; lunch?: boolean; dinner?: boolean } | null
): boolean {
  return !!(m && (m.breakfast || m.lunch || m.dinner));
}

function isGenericMealNote(note?: string | null): boolean {
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

function collectInclusions(snap: ProposalPdfSnapshot): {
  included: string[];
  excluded: string[];
} {
  if (!snap.itinerary) return { included: [], excluded: [] };
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
    included: dedupe(snap.itinerary.days.map((d) => d.inclusions)),
    excluded: dedupe(snap.itinerary.days.map((d) => d.exclusions)),
  };
}

// Soft tint of the accent for the inner seal ring — approximated since
// @react-pdf can't do color-mix. Accepts the accent and an alpha.
function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// --- monogram seal (two concentric circles, no ::after) -------------------

function Seal({
  agency,
  size,
  accent,
  onDark,
}: {
  agency: ProposalPdfSnapshot["agency"];
  size: number;
  accent: string;
  onDark?: boolean;
}) {
  // Logo wins if present.
  if (agency.logoUrl) {
    return (
      <Image
        src={agency.logoUrl}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          objectFit: "cover",
        }}
      />
    );
  }
  const inset = 3;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: alpha(accent, 0.65),
        backgroundColor: onDark ? "rgba(255,255,255,0.05)" : PAPER,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: (size - inset * 2) / 2,
          borderWidth: 1,
          borderColor: alpha(accent, 0.3),
        }}
      />
      <Text
        style={{
          fontFamily: "Times-Roman",
          color: accent,
          fontSize: size * 0.42,
        }}
      >
        {agency.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// --- main document --------------------------------------------------------

export function ProposalDocument({
  snapshot,
}: {
  snapshot: ProposalPdfSnapshot;
}) {
  const accent = snapshot.branding.accent;
  const styles = makeStyles(accent);
  const { included, excluded } = collectInclusions(snapshot);
  const hasInclusions =
    snapshot.branding.showInclusions &&
    (included.length > 0 || excluded.length > 0);
  const hasTerms =
    snapshot.branding.showTerms && !!snapshot.agency.terms?.trim();

  return (
    <Document
      title={`${snapshot.agency.name} — ${snapshot.trip.destination}`}
      author={snapshot.agency.name}
    >
      <CoverPage snapshot={snapshot} styles={styles} accent={accent} />

      {/* Main content — one wrapping Page; header/footer repeat per sheet. */}
      <Page size="A4" style={styles.contentPage}>
        <RunningHeader snapshot={snapshot} styles={styles} accent={accent} />
        <RunningFooter snapshot={snapshot} styles={styles} />

        {snapshot.branding.showAtAGlance &&
          snapshot.itinerary &&
          snapshot.itinerary.days.length > 0 && (
            <AtAGlance snapshot={snapshot} styles={styles} accent={accent} />
          )}

        {snapshot.segments.length > 0 && (
          <TravelPlan snapshot={snapshot} styles={styles} accent={accent} />
        )}

        {snapshot.itinerary && (
          <DayByDay snapshot={snapshot} styles={styles} accent={accent} />
        )}

        {snapshot.pricing && (
          <PricingBlock snapshot={snapshot} styles={styles} accent={accent} />
        )}

        {hasInclusions && (
          <Inclusions
            included={included}
            excluded={excluded}
            styles={styles}
            accent={accent}
          />
        )}

        {hasTerms && (
          <TermsBlock terms={snapshot.agency.terms!} styles={styles} accent={accent} />
        )}
      </Page>

      <ClosingPage snapshot={snapshot} styles={styles} accent={accent} />
    </Document>
  );
}

// --- cover page -----------------------------------------------------------

function CoverPage({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const { trip, branding, agency, meta } = snapshot;
  const endDate = trip.startDate ? addDays(trip.startDate, trip.days - 1) : null;
  const dateRange =
    trip.startDate && endDate
      ? `${trip.startDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })} – ${fmtDate(endDate)}`
      : "Dates flexible";

  const showPhoto =
    branding.coverStyle === "photo" && !!snapshot.itinerary?.coverImageUrl;

  return (
    <Page size="A4" style={styles.coverPage}>
      {showPhoto && (
        <Image src={snapshot.itinerary!.coverImageUrl!} style={styles.coverImage} />
      )}
      <View style={styles.coverScrim} />
      <View style={[styles.coverGlow, { backgroundColor: alpha(accent, 0.16) }]} />

      <View style={styles.coverInner}>
        {/* top: brand + version */}
        <View style={styles.coverTop}>
          <View style={styles.coverBrand}>
            <Seal agency={agency} size={40} accent={accent} onDark />
            <View>
              <Text style={styles.coverWord}>{agency.name.toUpperCase()}</Text>
              <Text style={[styles.coverTag, { color: accent }]}>
                Crafted travel
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.coverVLabel}>Travel Proposal</Text>
            <Text style={styles.coverVValue}>v{meta.version}</Text>
          </View>
        </View>

        {/* headline */}
        <View>
          <Text style={[styles.coverKicker, { color: accent }]}>
            A JOURNEY FOR {trip.travelers}
          </Text>
          <Text style={styles.coverTitle}>{trip.destination}</Text>
          <Text style={styles.coverSub}>
            A {trip.days}-day {trip.travelType.toLowerCase()} journey, crafted
            with care from first light to last sunset.
          </Text>

          <View style={styles.coverMetaRow}>
            <MetaItem label="Duration" value={`${trip.days}D / ${Math.max(0, trip.days - 1)}N`} accent={accent} styles={styles} />
            <MetaItem label="Travel dates" value={dateRange} accent={accent} styles={styles} />
            <MetaItem label="Travellers" value={`${trip.travelers} guests`} accent={accent} styles={styles} />
            <MetaItem label="Style" value={trip.travelType} accent={accent} styles={styles} />
          </View>

          <Text style={styles.coverFooterText}>
            Prepared {fmtDate(meta.preparedAt)} · Valid for {meta.validityDays}{" "}
            days
          </Text>
        </View>
      </View>
    </Page>
  );
}

function MetaItem({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: string;
  accent: string;
  styles: Styles;
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaLabel, { color: accent }]}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// --- running header / footer ----------------------------------------------

function RunningHeader({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  return (
    <View style={styles.runningHeader} fixed>
      <Seal agency={snapshot.agency} size={24} accent={accent} />
      <Text style={styles.runningHeaderAgency}>{snapshot.agency.name}</Text>
      <Text style={styles.runningHeaderTrip}>
        · {snapshot.trip.destination} · v{snapshot.meta.version}
      </Text>
      <View style={{ flex: 1 }} />
      <Text
        style={styles.runningPage}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function RunningFooter({
  snapshot,
  styles,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
}) {
  return (
    <View style={styles.runningFooter} fixed>
      <Text style={styles.runningFooterText}>
        Crafted with TripCraft · for {snapshot.agency.name}
      </Text>
      <Text style={styles.runningFooterText}>
        {snapshot.agency.website || ""}
      </Text>
    </View>
  );
}

// --- section heading (left-aligned, gold rule) ----------------------------

function SectionHeading({
  eyebrow,
  title,
  styles,
  accent,
  breakBefore,
}: {
  eyebrow: string;
  title: string;
  styles: Styles;
  accent: string;
  breakBefore?: boolean;
}) {
  return (
    <View style={styles.sectionHeading} break={breakBefore}>
      <Text style={[styles.sectionEyebrow, { color: accent }]}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.ruleGold, { backgroundColor: accent }]} />
    </View>
  );
}

// --- at a glance ----------------------------------------------------------

function AtAGlance({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const { itinerary, trip } = snapshot;
  if (!itinerary) return null;
  const startDate = trip.startDate;

  return (
    <View style={styles.section}>
      <SectionHeading eyebrow="The Overview" title="Trip at a glance" styles={styles} accent={accent} />
      {itinerary.summary?.trim() ? (
        <Text style={styles.glanceSummary}>{itinerary.summary.trim()}</Text>
      ) : null}
      <View style={styles.gtbl} wrap>
        <View style={styles.gtblHead} fixed>
          <Text style={[styles.gtblHeadCell, styles.gCellDay]}>Day</Text>
          <Text style={[styles.gtblHeadCell, styles.gCellWide]}>Where</Text>
          <Text style={[styles.gtblHeadCell, styles.gCellWide]}>Stay</Text>
          <Text style={[styles.gtblHeadCell, styles.gCellHi]}>Highlights</Text>
        </View>
        {itinerary.days.map((day, i) => (
          <View key={i} style={styles.gtblRow} wrap={false}>
            <View style={styles.gCellDay}>
              <Text style={styles.gDayNum}>{String(i + 1).padStart(2, "0")}</Text>
              {startDate && (
                <Text style={styles.gDayDate}>
                  {fmtDayLabel(addDays(startDate, i))}
                </Text>
              )}
            </View>
            <Text style={[styles.gCellWide, styles.gPlace]}>
              {day.city || stripDayPrefix(day.title) || "—"}
            </Text>
            <Text style={[styles.gCellWide, styles.gBody]}>{day.hotel || "—"}</Text>
            <Text style={[styles.gCellHi, styles.gBody]}>
              {day.activities && day.activities.length > 0
                ? day.activities.slice(0, 3).join(" · ")
                : "—"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// --- travel plan ----------------------------------------------------------

function TravelPlan({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const flights = snapshot.segments.filter((s) => s.type === "FLIGHT");
  const trains = snapshot.segments.filter((s) => s.type === "TRAIN");
  const time = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const Group = ({
    title,
    segs,
  }: {
    title: string;
    segs: ProposalPdfSnapshot["segments"];
  }) => (
    <View style={styles.card} wrap={false}>
      <Text style={[styles.cardEyebrow, { color: accent }]}>{title}</Text>
      {segs.map((s) => {
        const isFlight = s.type === "FLIGHT";
        const id = isFlight
          ? [s.airline, s.flightNumber].filter(Boolean).join(" · ")
          : [s.trainName, s.trainNumber].filter(Boolean).join(" · ");
        const dep = new Date(s.departureTime);
        const arr = new Date(s.arrivalTime);
        return (
          <View key={s.id} style={styles.segmentRow}>
            <View style={styles.segmentRouteRow}>
              <Text style={styles.segmentRoute}>
                {s.from} → {s.to}
              </Text>
              <Text style={[styles.segmentDay, { color: accent }]}>
                Day {s.dayNumber}
              </Text>
            </View>
            {id ? <Text style={styles.segmentMeta}>{id}</Text> : null}
            <Text style={styles.segmentTime}>
              {dep.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}{" "}
              · {time(dep)} → {time(arr)}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.section}>
      <SectionHeading eyebrow="Getting there" title="Travel plan" styles={styles} accent={accent} />
      {flights.length > 0 && <Group title="Flights" segs={flights} />}
      {trains.length > 0 && <Group title="Trains" segs={trains} />}
    </View>
  );
}

// --- day by day -----------------------------------------------------------

function DayByDay({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const { itinerary, trip } = snapshot;
  if (!itinerary) return null;

  return (
    <View style={styles.section}>
      <SectionHeading eyebrow="The Journey" title="Day by day" styles={styles} accent={accent} />
      {itinerary.days.map((day, i) => {
        const dateLabel = trip.startDate
          ? fmtDayLabel(addDays(trip.startDate, i))
          : null;
        const meals = hasAnyMealsPdf(day.meals)
          ? ([
              day.meals?.breakfast && "Breakfast",
              day.meals?.lunch && "Lunch",
              day.meals?.dinner && "Dinner",
            ].filter(Boolean) as string[])
          : [];
        const foodText =
          !isGenericMealNote(day.foodNote || day.food) &&
          (day.foodNote || day.food)
            ? day.foodNote || day.food
            : null;
        return (
          <View key={i} style={styles.pdfDay} wrap={false}>
            {/* rail */}
            <View style={styles.dayRail}>
              <Text style={[styles.dayNum, { color: accent }]}>
                {String(i + 1).padStart(2, "0")}
              </Text>
              {dateLabel && <Text style={styles.dayDate}>{dateLabel}</Text>}
            </View>
            {/* body */}
            <View style={styles.dayBody}>
              <View style={styles.dayTitleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.dayTitle}>{stripDayPrefix(day.title)}</Text>
                  {day.city ? <Text style={styles.dayCity}>{day.city}</Text> : null}
                </View>
                {meals.length > 0 && (
                  <View style={styles.dayMeals}>
                    {meals.map((m) => (
                      <Text key={m} style={styles.mchip}>
                        {m}
                      </Text>
                    ))}
                  </View>
                )}
              </View>

              {day.summary?.trim() ? (
                <Text style={styles.dayText}>{day.summary.trim()}</Text>
              ) : null}

              {day.activities && day.activities.length > 0 ? (
                <View style={styles.dayExp}>
                  {day.activities.map((a, j) => (
                    <View key={j} style={styles.dayExpItem}>
                      <View style={[styles.dayBullet, { backgroundColor: accent }]} />
                      <Text style={styles.dayExpText}>{a}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {day.hotel && (
                <View style={styles.dayStay}>
                  <Text style={[styles.dayStayLabel, { color: accent }]}>
                    Where you&apos;ll stay
                  </Text>
                  <Text style={styles.dayStayValue}>
                    {day.hotel}
                    {day.roomType ? ` · ${day.roomType}` : ""}
                  </Text>
                </View>
              )}

              {foodText ? (
                <View style={styles.calloutBox}>
                  <Text style={[styles.calloutLabel, { color: accent }]}>Dining</Text>
                  <Text style={styles.calloutText}>{foodText}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// --- pricing --------------------------------------------------------------

function PricingBlock({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const { pricing, meta } = snapshot;
  if (!pricing) return null;
  const validUntil = addDays(meta.preparedAt, meta.validityDays);

  return (
    <View style={styles.section} break>
      <SectionHeading eyebrow="Investment" title="Your package price" styles={styles} accent={accent} />

      <View style={styles.investCard} wrap={false}>
        <View style={[styles.investGlow, { backgroundColor: alpha(accent, 0.16) }]} />
        <Text style={[styles.investEyebrow, { color: accent }]}>Total package</Text>
        <Text style={styles.investTotal}>{formatINR(pricing.total)}</Text>
        {pricing.travelers > 1 && (
          <Text style={styles.investPp}>
            {formatINR(pricing.perPerson)} per person · {pricing.travelers}{" "}
            travellers
          </Text>
        )}
      </View>

      {pricing.categories.length > 0 && (
        <View style={styles.brk} wrap={false}>
          <Text style={[styles.brkTitle, { color: accent }]}>
            How it breaks down
          </Text>
          {pricing.categories.map((c) => (
            <View key={c.category} style={styles.brkRow}>
              <Text style={styles.brkCat}>{c.label}</Text>
              <Text style={styles.brkAmt}>{formatINR(c.amount)}</Text>
            </View>
          ))}
          <View style={styles.brkTotalRow}>
            <Text style={styles.brkTotalLabel}>Total</Text>
            <Text style={[styles.brkTotalAmt, { color: accent }]}>
              {formatINR(pricing.total)}
            </Text>
          </View>
          <Text style={styles.validity}>
            All amounts are in Indian Rupees and inclusive of applicable service
            charges. This quotation is valid until {fmtDate(validUntil)}.
          </Text>
        </View>
      )}
    </View>
  );
}

// --- inclusions -----------------------------------------------------------

function Inclusions({
  included,
  excluded,
  styles,
  accent,
}: {
  included: string[];
  excluded: string[];
  styles: Styles;
  accent: string;
}) {
  return (
    <View style={styles.section}>
      <SectionHeading eyebrow="The fine print" title="What's included" styles={styles} accent={accent} />
      <View style={styles.incGrid}>
        {included.length > 0 && (
          <View style={styles.incCol} wrap={false}>
            <Text style={[styles.incHead, { color: "#3c6b48" }]}>
              Your package includes
            </Text>
            {included.map((it, i) => (
              <Text key={i} style={styles.incItem}>
                ✓ {it}
              </Text>
            ))}
          </View>
        )}
        {excluded.length > 0 && (
          <View style={styles.incCol} wrap={false}>
            <Text style={styles.incHeadMuted}>Not included</Text>
            {excluded.map((it, i) => (
              <Text key={i} style={styles.incItemMuted}>
                ✗ {it}
              </Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// --- terms ----------------------------------------------------------------

function TermsBlock({
  terms,
  styles,
  accent,
}: {
  terms: string;
  styles: Styles;
  accent: string;
}) {
  return (
    <View style={styles.section} wrap={false}>
      <View style={styles.termsBox}>
        <Text style={[styles.termsEyebrow, { color: accent }]}>
          Booking terms & conditions
        </Text>
        <Text style={styles.termsBody}>{terms}</Text>
      </View>
    </View>
  );
}

// --- closing --------------------------------------------------------------

function ClosingPage({
  snapshot,
  styles,
  accent,
}: {
  snapshot: ProposalPdfSnapshot;
  styles: Styles;
  accent: string;
}) {
  const { agency, branding } = snapshot;
  const contacts: { label: string; value: string }[] = [];
  if (agency.phone) contacts.push({ label: "Phone", value: agency.phone });
  if (agency.email) contacts.push({ label: "Email", value: agency.email });
  if (agency.website) contacts.push({ label: "Web", value: agency.website });

  return (
    <Page size="A4" style={styles.closingPage}>
      <View style={[styles.closingGlow, { backgroundColor: alpha(accent, 0.14) }]} />
      <View style={styles.closingInner}>
        <Seal agency={agency} size={60} accent={accent} onDark />
        <Text style={styles.closingSig}>
          {branding.signatureNote ??
            "When you're ready, we'll handle every detail — so all that's left for you is to arrive."}
        </Text>
        <Text style={[styles.closingEyebrow, { color: accent }]}>
          With warm regards
        </Text>
        <Text style={styles.closingAgency}>{agency.name}</Text>
        {contacts.length > 0 && (
          <View style={styles.closingContacts}>
            {contacts.map((c, i) => (
              <View key={i} style={styles.closingContactItem}>
                <Text style={[styles.closingContactLabel, { color: accent }]}>
                  {c.label}
                </Text>
                <Text style={styles.closingContactValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <Text style={styles.closingCraft}>Crafted with TripCraft</Text>
    </Page>
  );
}

// --- styles ---------------------------------------------------------------

type Styles = ReturnType<typeof makeStyles>;

function makeStyles(accent: string) {
  return StyleSheet.create({
    // cover ----------------------------------------------------------------
    coverPage: { backgroundColor: NAVY, color: ON_DARK, padding: 0 },
    coverImage: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: 0.5,
    },
    coverScrim: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: NAVY,
      opacity: 0.62,
    },
    coverGlow: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 300,
      height: 300,
      borderRadius: 150,
      opacity: 0.7,
    },
    coverInner: {
      padding: 50,
      height: "100%",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    coverTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    coverBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
    coverWord: {
      color: "#fff",
      fontFamily: "Helvetica-Bold",
      fontSize: 12,
      letterSpacing: 3,
    },
    coverTag: {
      fontSize: 7,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginTop: 4,
    },
    coverVLabel: {
      fontSize: 8,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.6)",
    },
    coverVValue: {
      fontSize: 11,
      color: "#fff",
      marginTop: 3,
    },
    coverKicker: {
      fontSize: 10,
      letterSpacing: 4,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 14,
    },
    coverTitle: {
      color: "#fff",
      fontSize: 74,
      fontFamily: "Times-Roman",
      lineHeight: 0.95,
    },
    coverSub: {
      marginTop: 16,
      color: "rgba(255,255,255,0.82)",
      fontFamily: "Times-Italic",
      fontSize: 16,
      lineHeight: 1.4,
      maxWidth: 420,
    },
    coverMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 34,
      paddingTop: 22,
      borderTopWidth: 0.5,
      borderTopColor: "rgba(255,255,255,0.2)",
    },
    metaItem: { width: "50%", marginBottom: 18 },
    metaLabel: {
      fontSize: 7,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    metaValue: {
      marginTop: 5,
      color: "#fff",
      fontFamily: "Times-Roman",
      fontSize: 15,
    },
    coverFooterText: {
      marginTop: 18,
      color: "rgba(255,255,255,0.5)",
      fontSize: 8,
      letterSpacing: 0.5,
    },

    // content page ---------------------------------------------------------
    contentPage: {
      backgroundColor: IVORY,
      color: INK,
      paddingTop: 60,
      paddingBottom: 48,
      paddingHorizontal: 44,
      fontFamily: "Helvetica",
    },
    runningHeader: {
      position: "absolute",
      top: 18,
      left: 44,
      right: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingBottom: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
    },
    runningHeaderAgency: {
      color: INK,
      fontFamily: "Helvetica-Bold",
      fontSize: 9,
    },
    runningHeaderTrip: {
      color: MUTED,
      fontSize: 8,
    },
    runningPage: {
      fontSize: 8,
      color: MUTED,
    },
    runningFooter: {
      position: "absolute",
      bottom: 18,
      left: 44,
      right: 44,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 6,
      borderTopWidth: 0.5,
      borderTopColor: LINE,
    },
    runningFooterText: {
      color: FAINT,
      fontSize: 7,
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },

    // section heading ------------------------------------------------------
    section: { marginTop: 16, marginBottom: 6 },
    sectionHeading: { marginBottom: 16 },
    sectionEyebrow: {
      fontSize: 8,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 7,
    },
    sectionTitle: {
      fontSize: 28,
      color: NAVY,
      fontFamily: "Times-Roman",
    },
    ruleGold: { marginTop: 12, width: 64, height: 2 },

    // at a glance ----------------------------------------------------------
    glanceSummary: {
      fontSize: 11,
      lineHeight: 1.7,
      color: INK2,
      marginBottom: 18,
      maxWidth: 480,
    },
    gtbl: { borderWidth: 0.5, borderColor: LINE, borderRadius: 4 },
    gtblHead: {
      flexDirection: "row",
      backgroundColor: IVORY2,
      borderBottomWidth: 1,
      borderBottomColor: NAVY,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    gtblHeadCell: {
      fontSize: 7,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      color: MUTED,
      fontFamily: "Helvetica-Bold",
    },
    gtblRow: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    gCellDay: { width: 70, paddingRight: 6 },
    gCellWide: { flex: 1.2, paddingRight: 8 },
    gCellHi: { flex: 1.8 },
    gDayNum: { fontSize: 11, color: accent, fontFamily: "Helvetica-Bold" },
    gDayDate: {
      marginTop: 2,
      fontSize: 7,
      color: MUTED,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    gPlace: { fontFamily: "Times-Roman", fontSize: 12, color: NAVY },
    gBody: { fontSize: 9, color: INK2, lineHeight: 1.4 },

    // card / segments ------------------------------------------------------
    card: {
      borderWidth: 0.5,
      borderColor: LINE,
      borderRadius: 4,
      padding: 12,
      marginBottom: 10,
      backgroundColor: PAPER,
    },
    cardEyebrow: {
      fontSize: 8,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 8,
    },
    segmentRow: {
      paddingVertical: 6,
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
    },
    segmentRouteRow: { flexDirection: "row", justifyContent: "space-between" },
    segmentRoute: { fontFamily: "Helvetica-Bold", color: NAVY, fontSize: 10 },
    segmentDay: {
      fontSize: 7,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    segmentMeta: { marginTop: 2, fontSize: 9, color: INK },
    segmentTime: { marginTop: 1, fontSize: 9, color: MUTED },

    // day block ------------------------------------------------------------
    pdfDay: {
      flexDirection: "row",
      gap: 22,
      paddingVertical: 18,
      borderTopWidth: 0.5,
      borderTopColor: LINE,
    },
    dayRail: { width: 70 },
    dayNum: { fontFamily: "Times-Roman", fontSize: 40, lineHeight: 0.8 },
    dayDate: {
      fontSize: 8,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      color: MUTED,
      marginTop: 8,
    },
    dayBody: { flex: 1 },
    dayTitleRow: { flexDirection: "row", justifyContent: "space-between" },
    dayTitle: { fontFamily: "Times-Roman", fontSize: 21, color: NAVY, lineHeight: 1.1 },
    dayCity: {
      fontSize: 8,
      color: MUTED,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginTop: 4,
    },
    dayMeals: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
    mchip: {
      backgroundColor: "#E7F0E8",
      color: "#3c6b48",
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 3,
      textTransform: "uppercase",
    },
    dayText: { fontSize: 11, lineHeight: 1.65, color: INK2, marginTop: 10 },
    dayExp: { marginTop: 12 },
    dayExpItem: { flexDirection: "row", gap: 8, marginBottom: 4 },
    dayBullet: { width: 5, height: 5, borderRadius: 2.5, marginTop: 4 },
    dayExpText: { fontSize: 10, color: INK, flex: 1, lineHeight: 1.4 },
    dayStay: {
      marginTop: 12,
      paddingTop: 10,
      paddingHorizontal: 12,
      paddingBottom: 10,
      backgroundColor: PAPER,
      borderWidth: 0.5,
      borderColor: LINE,
      borderRadius: 5,
    },
    dayStayLabel: {
      fontSize: 7,
      letterSpacing: 1.4,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    dayStayValue: { marginTop: 3, fontFamily: "Times-Roman", fontSize: 13, color: NAVY },
    calloutBox: {
      marginTop: 10,
      padding: 9,
      backgroundColor: IVORY2,
      borderRadius: 4,
    },
    calloutLabel: {
      fontSize: 7,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 3,
    },
    calloutText: { fontSize: 9, color: INK2, lineHeight: 1.5 },

    // investment -----------------------------------------------------------
    investCard: {
      backgroundColor: NAVY,
      borderRadius: 8,
      paddingVertical: 30,
      paddingHorizontal: 32,
      marginBottom: 20,
      position: "relative",
      overflow: "hidden",
    },
    investGlow: {
      position: "absolute",
      top: -40,
      right: -40,
      width: 220,
      height: 220,
      borderRadius: 110,
    },
    investEyebrow: {
      fontSize: 9,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    investTotal: {
      fontFamily: "Times-Roman",
      fontSize: 52,
      color: "#fff",
      marginTop: 12,
      lineHeight: 0.95,
    },
    investPp: {
      fontSize: 11,
      color: "rgba(255,255,255,0.66)",
      marginTop: 12,
    },
    brk: {},
    brkTitle: {
      fontSize: 8,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
    },
    brkRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 9,
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
    },
    brkCat: { fontSize: 11, color: INK2 },
    brkAmt: { fontSize: 11, color: INK, fontFamily: "Helvetica-Bold" },
    brkTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 12,
    },
    brkTotalLabel: {
      fontFamily: "Times-Roman",
      fontSize: 15,
      color: NAVY,
    },
    brkTotalAmt: { fontFamily: "Times-Roman", fontSize: 19 },
    validity: { marginTop: 14, fontSize: 9, color: MUTED, lineHeight: 1.6 },

    // inclusions -----------------------------------------------------------
    incGrid: { flexDirection: "row", gap: 18 },
    incCol: { flex: 1 },
    incHead: {
      fontSize: 9,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      paddingBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
      marginBottom: 12,
    },
    incHeadMuted: {
      fontSize: 9,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      color: MUTED,
      paddingBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: LINE,
      marginBottom: 12,
    },
    incItem: { fontSize: 10, color: INK2, marginBottom: 6, lineHeight: 1.4 },
    incItemMuted: { fontSize: 10, color: MUTED, marginBottom: 6, lineHeight: 1.4 },

    // terms ----------------------------------------------------------------
    termsBox: {
      borderWidth: 0.5,
      borderColor: LINE,
      backgroundColor: IVORY2,
      padding: 16,
      borderRadius: 6,
    },
    termsEyebrow: {
      fontSize: 8,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 8,
    },
    termsBody: { fontSize: 9.5, color: INK2, lineHeight: 1.7 },

    // closing --------------------------------------------------------------
    closingPage: {
      backgroundColor: NAVY,
      paddingVertical: 80,
      paddingHorizontal: 56,
      position: "relative",
    },
    closingGlow: {
      position: "absolute",
      top: 60,
      left: "50%",
      marginLeft: -150,
      width: 300,
      height: 300,
      borderRadius: 150,
    },
    closingInner: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 120,
    },
    closingSig: {
      fontFamily: "Times-Italic",
      fontSize: 22,
      color: "#fff",
      lineHeight: 1.5,
      textAlign: "center",
      maxWidth: 380,
      marginTop: 26,
    },
    closingEyebrow: {
      fontSize: 9,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginTop: 26,
    },
    closingAgency: {
      fontFamily: "Times-Roman",
      fontSize: 28,
      color: "#fff",
      marginTop: 8,
    },
    closingContacts: {
      flexDirection: "row",
      gap: 40,
      marginTop: 26,
      justifyContent: "center",
    },
    closingContactItem: { alignItems: "center" },
    closingContactLabel: {
      fontSize: 8,
      letterSpacing: 1.8,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    closingContactValue: { marginTop: 5, fontSize: 11, color: "#fff" },
    closingCraft: {
      position: "absolute",
      bottom: 44,
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 8,
      letterSpacing: 2.4,
      textTransform: "uppercase",
      color: "rgba(255,255,255,0.38)",
    },
  });
}
