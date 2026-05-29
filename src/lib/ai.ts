import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export const genai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Per-day meal toggles. Independent booleans so an agent can mark, say,
 * "breakfast + dinner included" without forcing a string template.
 */
export type DayMeals = {
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
};

/**
 * A day on the itinerary.
 *
 * Layers:
 *   Agent-owned (structured facts) — `city`, `hotel`, `roomType`, `mealPlan`,
 *   `activities[]`, `inclusions[]`, `exclusions[]`, `transferNote`, `imageUrl`,
 *   `meals`, `foodNote`. The AI must NOT invent these — it uses them verbatim.
 *
 *   AI-written (prose) — `title`, `summary`, `notes`. Regenerate replaces
 *   these and only these.
 *
 * Legacy fields (`morning` / `afternoon` / `evening` / `food` / `sights`) are
 * kept optional so old itineraries continue to render. The `readDay()` helper
 * upgrades legacy days to the new shape on read.
 */
export type ItineraryDay = {
  // AI-written prose
  title: string;
  /** Single-paragraph day overview. Replaces morning/afternoon/evening. */
  summary?: string;
  notes?: string;

  // Agent-owned structured facts
  city?: string | null;
  hotel?: string | null;
  roomType?: string | null;
  mealPlan?: string | null;
  meals?: DayMeals;
  /** Free-text food highlights ("Try the duck at Mozaic"). */
  foodNote?: string | null;
  activities?: string[];
  inclusions?: string[];
  exclusions?: string[];
  transferNote?: string | null;
  imageUrl?: string | null;

  // --- Legacy fields ---
  // Existing trips still have these populated; new code reads via readDay()
  // which collapses them into `summary` + `activities` + `meals`.
  morning?: string;
  afternoon?: string;
  evening?: string;
  food?: string;
  sights?: string[];
};

export type ItineraryContent = {
  summary: string;
  days: ItineraryDay[];
  coverImageUrl?: string | null;
  heroSubtitle?: string | null;
};

export type DayPlan = {
  city?: string | null;
  hotel?: string | null;
  roomType?: string | null;
  mealPlan?: string | null;
  activities?: string[];
  inclusions?: string[];
  exclusions?: string[];
  transferNote?: string | null;
};

export type GenerateInput = {
  destination: string;
  days: number;
  travelers: number;
  travelType: string;
  budget?: number | null;
  pace: string;
  interests: string[];
  hotelType: string;
  notes?: string | null;
  /**
   * Optional per-day structured plan from the agent. When present, the AI
   * must use these as ground truth — exact hotel name, exact activities, etc.
   * If absent or sparse, the AI may infer creatively.
   */
  dayPlans?: DayPlan[];
};

// ---------------------------------------------------------------------------
// Back-compat reader
// ---------------------------------------------------------------------------

/**
 * Returns a day in the canonical new shape, synthesizing missing fields from
 * legacy data. Idempotent — calling on an already-modern day is a no-op.
 *
 *   summary  ← summary OR concat(morning + afternoon + evening)
 *   activities ← activities OR sights
 *   meals    ← meals OR inferred from mealPlan text (BB / HB / AP / AI / CP)
 */
export function readDay(raw: ItineraryDay): ItineraryDay {
  const summary =
    raw.summary?.trim() ||
    [
      raw.morning?.trim() && `Morning — ${raw.morning.trim()}`,
      raw.afternoon?.trim() && `Afternoon — ${raw.afternoon.trim()}`,
      raw.evening?.trim() && `Evening — ${raw.evening.trim()}`,
    ]
      .filter(Boolean)
      .join("\n\n") ||
    "";

  const activities =
    raw.activities && raw.activities.length > 0
      ? raw.activities
      : raw.sights ?? [];

  const meals = raw.meals ?? inferMealsFromPlan(raw.mealPlan);

  return {
    ...raw,
    summary,
    activities,
    meals,
  };
}

/**
 * Cleans an in-memory day before persisting — drops legacy fields, normalizes
 * structured arrays, trims strings. Call this on save / regenerate so the DB
 * gradually heals to the new shape.
 */
export function writeDay(d: ItineraryDay): ItineraryDay {
  // Strip legacy fields from the persisted payload.
  // We keep the visible fields and drop the rest.
  const cleaned: ItineraryDay = {
    title: d.title,
    summary: d.summary?.trim() || "",
    notes: d.notes?.trim() || "",
    city: d.city?.trim() || null,
    hotel: d.hotel?.trim() || null,
    roomType: d.roomType?.trim() || null,
    mealPlan: d.mealPlan?.trim() || null,
    meals: d.meals ?? {},
    foodNote: d.foodNote?.trim() || null,
    activities: (d.activities ?? []).filter((s) => s.trim().length > 0),
    inclusions: (d.inclusions ?? []).filter((s) => s.trim().length > 0),
    exclusions: (d.exclusions ?? []).filter((s) => s.trim().length > 0),
    transferNote: d.transferNote?.trim() || null,
    imageUrl: d.imageUrl ?? null,
  };
  return cleaned;
}

/**
 * Translate a meal-plan string into toggles. Handles both industry codes
 * (BB / CP / HB / MAP / AP / FB / AI / EP) AND free-form phrasings like
 * "BB+D", "Breakfast and dinner", "B+L+D" — the latter were silently
 * dropping meals before, because the first-match-wins regex would stop at
 * "BB" and never see the "+D".
 */
function inferMealsFromPlan(plan?: string | null): DayMeals {
  if (!plan) return {};
  const t = plan.trim().toUpperCase();

  // Standard codes — each implies a fixed, well-defined set of meals.
  if (/\bAI\b|ALL.?INCLUSIVE/.test(t)) {
    return { breakfast: true, lunch: true, dinner: true };
  }
  if (/\bAP\b|FULL.?BOARD|\bFB\b/.test(t)) {
    return { breakfast: true, lunch: true, dinner: true };
  }
  if (/\bMAP\b|HALF.?BOARD|\bHB\b/.test(t)) {
    return { breakfast: true, dinner: true };
  }
  if (/\bEP\b|ROOM.?ONLY|EUROPEAN.?PLAN/.test(t)) {
    return {};
  }

  // Free-form / compound shorthand — detect each meal independently so
  // "BB+D" gets both breakfast AND dinner, not just breakfast.
  const meals: DayMeals = {};
  if (/BREAKFAST|\bBB\b|\bCP\b|B&B|BED.?AND.?BREAKFAST/.test(t)) {
    meals.breakfast = true;
  }
  if (/LUNCH|\+\s*L\b/.test(t)) {
    meals.lunch = true;
  }
  if (/DINNER|SUPPER|\+\s*D\b/.test(t)) {
    meals.dinner = true;
  }
  return meals;
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

const SYSTEM = `You are a senior luxury travel curator. You write calm, premium, evocative copy. Avoid clichés and exclamation marks. Be concise but vivid. When given specific facts (hotel names, activities, inclusions), you treat them as authoritative — never substitute, invent, or omit them. Your job is to write prose that wraps those facts gracefully. You NEVER invent activities, sights, or experiences the agent did not provide: the "activities" array for a day must contain only the activities the agent listed for that day (verbatim), and stay empty when none were listed.`;

function budgetTier(input: GenerateInput) {
  if (!input.budget) return "Mid-range to premium";
  const perPersonPerDay = input.budget / input.travelers / input.days;
  if (perPersonPerDay >= 25000) return "Ultra-luxury";
  if (perPersonPerDay >= 12000) return "Luxury";
  if (perPersonPerDay >= 6000) return "Premium";
  return "Mid-range";
}

function isStructured(plan?: DayPlan): boolean {
  if (!plan) return false;
  return Boolean(
    plan.city?.trim() ||
      plan.hotel?.trim() ||
      plan.roomType?.trim() ||
      plan.mealPlan?.trim() ||
      plan.transferNote?.trim() ||
      (plan.activities && plan.activities.length > 0) ||
      (plan.inclusions && plan.inclusions.length > 0) ||
      (plan.exclusions && plan.exclusions.length > 0)
  );
}

function renderDayBriefs(input: GenerateInput): string {
  if (!input.dayPlans || input.dayPlans.every((p) => !isStructured(p))) {
    return "";
  }
  const lines = input.dayPlans
    .map((plan, i) => {
      if (!isStructured(plan)) {
        return `Day ${i + 1}: (no structured input — use creative judgment based on destination, pace, and interests)`;
      }
      const parts: string[] = [];
      if (plan.city?.trim()) parts.push(`City: ${plan.city.trim()}`);
      if (plan.hotel?.trim()) {
        const hotelLine = plan.roomType?.trim()
          ? `Hotel: ${plan.hotel.trim()} (${plan.roomType.trim()})`
          : `Hotel: ${plan.hotel.trim()}`;
        parts.push(hotelLine);
      } else if (plan.roomType?.trim()) {
        parts.push(`Room type: ${plan.roomType.trim()}`);
      }
      if (plan.mealPlan?.trim()) parts.push(`Meal plan: ${plan.mealPlan.trim()}`);
      if (plan.activities && plan.activities.length > 0) {
        parts.push(`Activities (anchor the day around these): ${plan.activities.join(", ")}`);
      }
      if (plan.inclusions && plan.inclusions.length > 0) {
        parts.push(`Inclusions (mention naturally): ${plan.inclusions.join(", ")}`);
      }
      if (plan.exclusions && plan.exclusions.length > 0) {
        parts.push(`Exclusions (only flag if relevant): ${plan.exclusions.join(", ")}`);
      }
      if (plan.transferNote?.trim()) {
        parts.push(`Transfer note: ${plan.transferNote.trim()}`);
      }
      return `Day ${i + 1}:\n   - ${parts.join("\n   - ")}`;
    })
    .join("\n\n");

  return `

Per-day briefs from the agent (these are AUTHORITATIVE — use exact names, do not substitute):

${lines}

Rules when day briefs are present:
- Use the exact hotel name and city. Do not invent or change them.
- The "summary" prose should anchor the day around the listed activities — they are the spine.
- Naturally weave inclusions into the prose (e.g. "your private guide will meet you at the lobby").
- If a transfer note is provided, surface it in the "notes" field along with logistics.
- If meal plan implies a meal at the hotel, mention it in the "foodNote" field accurately
  (B&B = breakfast at hotel; MAP/Half-board = breakfast and dinner; AP/Full-board = all meals; AI = all-inclusive).
- NEVER invent activities. The "activities" array must list ONLY the activities the agent provided for that day, verbatim. Do not add, substitute, or pad.
- For days WITHOUT listed activities, return an empty "activities" array and write a calm, general summary (a free day to explore the city at leisure) WITHOUT naming specific attractions, sights, or experiences.`;
}

function buildPrompt(input: GenerateInput) {
  const interests =
    input.interests.length > 0
      ? input.interests.join(", ")
      : "general sightseeing, food, and culture";
  const notes = input.notes?.trim() || "None";
  const travelersDesc = `${input.travelers} ${
    input.travelers === 1 ? "traveler" : "travelers"
  } (${input.travelType})`;

  return `Create a highly personalized, premium travel itinerary.

Trip Details:

* Destination: ${input.destination}
* Duration: ${input.days} days
* Travelers: ${travelersDesc}
* Budget level: ${budgetTier(input)}${
    input.budget ? ` (₹${input.budget.toLocaleString("en-IN")} total)` : ""
  }
* Travel style: ${input.pace}
* Interests: ${interests}
* Hotel category preference: ${input.hotelType}
* Special notes: ${notes}${renderDayBriefs(input)}

Output requirements (return JSON ONLY, no commentary):

{
  "summary": "2-3 sentence overview of the entire trip",
  "days": [
    {
      "title": "Day 1: Arrival & welcome",
      "summary": "A single calm paragraph (3-5 sentences) describing the day's flow — what they'll experience, the mood, the highlights. Do NOT split into morning/afternoon/evening.",
      "activities": ["ONLY the activities the agent listed for this day, verbatim — empty array if none"],
      "foodNote": "Specific dining recommendation or meal-plan note (1 sentence).",
      "notes": "Logistics + insider tips: transfers, distances, what to carry, hidden gems."
    }
  ]
}

Produce exactly ${input.days} day(s).
Activities — STRICT: the "activities" array must contain ONLY the activities the agent listed for that day in the per-day briefs, copied verbatim. NEVER invent, add, substitute, or pad activities. If a day has no listed activities, return an empty "activities" array and let the summary describe a relaxed free day WITHOUT naming any specific attraction.
Keep summary prose vivid but tight. No overpacking. Mention rest where the pace warrants it.
Personalize for traveler type: Honeymoon → romantic; Family → kid-friendly; Luxury → premium; Solo → flexible.`;
}

export async function generateItineraryAI(
  input: GenerateInput
): Promise<ItineraryContent> {
  if (!genai) {
    return mockItinerary(input);
  }
  try {
    const response = await genai.models.generateContent({
      model,
      contents: buildPrompt(input),
      config: {
        systemInstruction: SYSTEM,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });
    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw) as ItineraryContent;
    if (!parsed?.days?.length) throw new Error("Empty itinerary");
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[gemini] falling back to mock itinerary —", msg);
    return mockItinerary(input);
  }
}

/**
 * Rewrite prose for a single day. Keeps surrounding days untouched. Returns
 * just the day object (caller merges back).
 */
export async function regenerateDayAI(
  input: GenerateInput,
  dayIndex: number,
  currentDay: ItineraryDay
): Promise<ItineraryDay> {
  const plan = input.dayPlans?.[dayIndex] ?? null;
  const fallback = (): ItineraryDay => {
    const mock = mockItinerary(input);
    const m = mock.days[dayIndex] ?? mock.days[0];
    return {
      ...currentDay,
      title: m.title,
      summary: m.summary,
      foodNote: m.foodNote ?? currentDay.foodNote,
      notes: m.notes,
    };
  };

  if (!genai) return fallback();

  const briefLines: string[] = [];
  if (plan?.city?.trim()) briefLines.push(`City: ${plan.city.trim()}`);
  if (plan?.hotel?.trim()) {
    briefLines.push(
      `Hotel: ${plan.hotel.trim()}${plan.roomType?.trim() ? ` (${plan.roomType.trim()})` : ""}`
    );
  }
  if (plan?.mealPlan?.trim()) briefLines.push(`Meal plan: ${plan.mealPlan.trim()}`);
  if (plan?.activities && plan.activities.length > 0) {
    briefLines.push(`Activities to anchor the day: ${plan.activities.join(", ")}`);
  }
  if (plan?.inclusions && plan.inclusions.length > 0) {
    briefLines.push(`Inclusions: ${plan.inclusions.join(", ")}`);
  }
  if (plan?.transferNote?.trim()) briefLines.push(`Transfer: ${plan.transferNote.trim()}`);

  const prompt = `Rewrite the prose for Day ${dayIndex + 1} of a ${input.days}-day trip to ${input.destination}.

Trip context:
- Travelers: ${input.travelers} (${input.travelType})
- Pace: ${input.pace}
- Interests: ${input.interests.join(", ") || "general sightseeing"}

Day ${dayIndex + 1} brief (USE THESE FACTS EXACTLY — do not substitute or invent):
${briefLines.length > 0 ? briefLines.join("\n") : "(no structured brief — use creative judgment based on trip context)"}

Return JSON ONLY in this exact shape (just this single day, no array):
{
  "title": "Day ${dayIndex + 1}: ...",
  "summary": "A single calm paragraph (3-5 sentences) describing the day's flow — what they'll experience, the mood, the highlights. Do NOT split into morning/afternoon/evening.",
  "foodNote": "Specific dining recommendation (1 sentence).",
  "notes": "Logistics + insider tips: transfers, distances, what to carry, hidden gems."
}`;

  try {
    const response = await genai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });
    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ItineraryDay>;
    if (!parsed.summary?.trim()) throw new Error("Empty day");
    return {
      ...currentDay,
      title: parsed.title ?? currentDay.title,
      summary: parsed.summary ?? currentDay.summary,
      foodNote: parsed.foodNote ?? currentDay.foodNote,
      notes: parsed.notes ?? currentDay.notes,
      // Drop legacy fields when AI rewrites
      morning: undefined,
      afternoon: undefined,
      evening: undefined,
      food: undefined,
    };
  } catch (err) {
    console.warn(
      "[gemini] day rewrite failed, falling back —",
      err instanceof Error ? err.message : String(err)
    );
    return fallback();
  }
}

/**
 * Suggests 5–8 specific, well-known activities for the given city/day context.
 */
export async function suggestActivitiesAI(args: {
  city: string;
  destination: string;
  travelType: string;
  interests: string[];
  excluding?: string[];
}): Promise<string[]> {
  const fallback = [
    `${args.city} city walk`,
    `${args.city} signature museum`,
    `Local market`,
    `Sunset viewpoint`,
    `Iconic temple or landmark`,
    `Renowned restaurant`,
  ];
  if (!genai) return fallback;

  const exclude =
    args.excluding && args.excluding.length > 0
      ? `\nDo NOT suggest any of these (already on the day): ${args.excluding.join(", ")}`
      : "";

  const prompt = `List 6–8 specific, well-known sights, experiences, or activities in ${args.city}${args.city.toLowerCase().includes(args.destination.toLowerCase()) ? "" : `, ${args.destination}`} that suit a ${args.travelType.toLowerCase()} traveler interested in ${args.interests.join(", ") || "general sightseeing"}.

Constraints:
- Return ONLY proper-noun place names or precisely-named experiences (e.g. "Sacred Monkey Forest", "Sunset cocktails at Rock Bar", not "a temple visit").
- Each item must be specific enough to Google.
- Mix sights, food experiences, and active experiences naturally.
- No commentary, no numbering.${exclude}

Return JSON ONLY in this exact shape:
{ "activities": ["...", "...", ...] }`;

  try {
    const response = await genai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        temperature: 0.6,
        responseMimeType: "application/json",
      },
    });
    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw) as { activities?: string[]; sights?: string[] };
    const list = parsed.activities ?? parsed.sights ?? [];
    const out = list
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, 8);
    return out.length > 0 ? out : fallback;
  } catch (err) {
    console.warn(
      "[gemini] activity suggestions failed —",
      err instanceof Error ? err.message : String(err)
    );
    return fallback;
  }
}

/** Back-compat alias. Kept for any callers that still import the old name. */
export const suggestSightsAI = suggestActivitiesAI;

export function blankDay(index: number): ItineraryDay {
  return {
    title: `Day ${index + 1}: New day`,
    summary: "",
    notes: "",
    meals: {},
    activities: [],
    inclusions: [],
    exclusions: [],
  };
}

function mockItinerary(input: GenerateInput): ItineraryContent {
  return {
    summary: `A ${input.days}-day ${input.travelType.toLowerCase()} journey through ${input.destination}, paced ${input.pace.toLowerCase()} and centered on ${
      input.interests.length > 0
        ? input.interests.slice(0, 3).join(", ")
        : "the destination's signature experiences"
    }.`,
    days: Array.from({ length: input.days }, (_, i) => {
      const plan = input.dayPlans?.[i];
      const hotelLine = plan?.hotel
        ? `at ${plan.hotel}${plan.roomType ? ` (${plan.roomType})` : ""}`
        : "at the hotel";
      const activityList =
        plan?.activities && plan.activities.length > 0 ? plan.activities : null;

      const summary = activityList
        ? `Begin with breakfast ${hotelLine}, then a curated visit to ${activityList.slice(0, 2).join(" and ")}. After a relaxed lunch, the afternoon unfolds with ${activityList.slice(2, 4).join(", ") || "a signature experience"}. End the day with sunset views and a chef-led dinner.`
        : `Begin gently with breakfast ${hotelLine}, followed by a curated walk through a quiet quarter of the city. A signature lunch at a local favorite leads into a private experience handpicked for the day's theme. Evening sunset views from a curated vantage point, followed by a chef-led dinner.`;

      return {
        title: `Day ${i + 1}: ${
          i === 0
            ? "Arrival & leisure"
            : i === input.days - 1
              ? "Farewell & departure"
              : plan?.city
                ? `Exploring ${plan.city}`
                : `Exploring ${input.destination}`
        }`,
        summary,
        activities: activityList ?? [],
        foodNote: plan?.mealPlan
          ? `Meal plan: ${plan.mealPlan}. Dine ${hotelLine} where included; reservations made on your behalf elsewhere.`
          : `Local specialty for lunch, regional thali for dinner. Reservations made on your behalf.`,
        notes: plan?.transferNote
          ? `${plan.transferNote}. ${plan.inclusions?.length ? "Inclusions: " + plan.inclusions.join(", ") + "." : ""} Carry a light layer for evenings.`
          : `Local transfers via private car (15–20 min between stops). Carry a light layer for evenings. Insider tip: ask the concierge for the off-menu dessert.`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// "Build to spec" — generate a trip + itinerary from a freeform brief.
//
// Used by the "Detailed brief" tab on /trips/new. The agent dumps the
// requirements as natural prose; the model extracts the structured Trip
// columns AND writes the day-by-day in a single call.
// ---------------------------------------------------------------------------

export const BRIEF_TRAVEL_TYPES = [
  "Luxury",
  "Honeymoon",
  "Family",
  "Budget",
] as const;
export const BRIEF_PACES = ["Relaxed", "Moderate", "Packed"] as const;
export const BRIEF_HOTEL_TYPES = [
  "Boutique",
  "Luxury Resort",
  "Heritage",
  "Villa",
  "Standard",
] as const;

export type BriefTrip = {
  destination: string;
  days: number;
  travelers: number;
  startDate: string | null; // YYYY-MM-DD or null
  budget: number | null;
  travelType: (typeof BRIEF_TRAVEL_TYPES)[number];
  pace: (typeof BRIEF_PACES)[number];
  hotelType: (typeof BRIEF_HOTEL_TYPES)[number];
  interests: string[];
  /** Free-form catch-all for specifics not modelled on Trip — vehicles,
   *  pick-up/drop, meal-plan shorthand, special requests. */
  notes: string;
};

export type BriefResult = {
  trip: BriefTrip;
  itinerary: ItineraryContent;
};

const BRIEF_SYSTEM = `You are a senior travel operations specialist. Given a freeform brief from a travel agent, you extract the trip's structured details AND build a day-by-day itinerary that follows the brief EXACTLY. You never invent activities, hotels, vehicles, meal plans, or routes the agent did not mention. When the agent says something specific ("Swift Dzire ex-Delhi", "2N Shimla / 2N Manali", "BB+D"), you preserve it verbatim in the appropriate field — do not paraphrase it away. Tone is calm, premium, factual.`;

function buildBriefPrompt(brief: string): string {
  return `Read this agent brief and return BOTH the structured trip fields AND the full day-by-day itinerary.

Agent brief (verbatim):
"""
${brief.trim()}
"""

Output requirements — return JSON ONLY in this exact shape:

{
  "trip": {
    "destination": "string (2-80 chars). If multiple cities, combine like 'Shimla & Manali'.",
    "days": number (1-30, total trip days including arrival/departure),
    "travelers": number (1-40, default 2 if not stated),
    "startDate": "YYYY-MM-DD or null. Only set if the brief gives a concrete date — never guess.",
    "budget": "number in INR, or null if not stated",
    "travelType": "one of: Luxury | Honeymoon | Family | Budget (best fit; default Family for unspecified)",
    "pace": "one of: Relaxed | Moderate | Packed (default Moderate)",
    "hotelType": "one of: Boutique | Luxury Resort | Heritage | Villa | Standard (default Standard)",
    "interests": ["array of broad interest tags inferred from the brief — e.g. Nature, Adventure, Culture"],
    "notes": "Capture EVERY specific the brief mentioned that doesn't map to other fields: pickup/drop city + vehicle, meal-plan shorthand, special requests. Concise sentences, NO marketing prose."
  },
  "itinerary": {
    "summary": "2-3 sentence overview that mirrors the brief — same destinations, same shape.",
    "days": [
      {
        "title": "Day 1: <short title that reflects the brief's day-1 plan>",
        "summary": "Single paragraph (3-5 sentences) describing the day's flow, anchored on what the brief said. No fabrication.",
        "city": "the city the day takes place in (e.g. 'Shimla')",
        "hotel": null,
        "mealPlan": "the meal plan as stated (e.g. 'BB+D' or 'Breakfast + Dinner') — null if not specified",
        "activities": ["EXACT named places/experiences from the brief for this day; no additions"],
        "transferNote": "any transfer/transport mentioned for this day (e.g. 'Pickup ex-Delhi by Swift Dzire to Shimla')",
        "foodNote": "ONLY a specific dining recommendation the brief explicitly mentions (e.g. 'Authentic Himachali thali at Manikaran gurudwara'). DO NOT restate which meals are included — meal chips already convey that. If the brief has no specific food recommendation, leave this null.",
        "notes": "logistics relevant to this day; null if none"
      }
    ]
  }
}

Rules — these are non-negotiable:
- Produce EXACTLY trip.days day objects in itinerary.days.
- Use destinations and activities VERBATIM from the brief. If the brief says "Jakhu temple", write "Jakhu temple" — don't substitute "a hilltop temple".
- If the brief assigns an activity to a specific day, that activity goes ONLY on that day.
- If the brief mentions transport (vehicle + route), record it on the relevant day's transferNote AND in trip.notes.
- Meal plans: keep the agent's shorthand (BB / BB+D / MAP / AP / AI) in mealPlan; expand naturally into foodNote.
- For days the brief does not detail, leave activities as an empty array — do NOT invent fillers.
- Pick the closest enum value for travelType / pace / hotelType; do not invent new values.
- startDate: ONLY set when an explicit date is in the brief. Otherwise null.`;
}

function coerceTravelType(v: unknown): BriefTrip["travelType"] {
  return BRIEF_TRAVEL_TYPES.includes(v as BriefTrip["travelType"])
    ? (v as BriefTrip["travelType"])
    : "Family";
}
function coercePace(v: unknown): BriefTrip["pace"] {
  return BRIEF_PACES.includes(v as BriefTrip["pace"])
    ? (v as BriefTrip["pace"])
    : "Moderate";
}
function coerceHotelType(v: unknown): BriefTrip["hotelType"] {
  return BRIEF_HOTEL_TYPES.includes(v as BriefTrip["hotelType"])
    ? (v as BriefTrip["hotelType"])
    : "Standard";
}

/** Normalize whatever the model returned into a safe BriefResult. */
function normalizeBriefResult(raw: unknown, brief: string): BriefResult {
  const r = (raw ?? {}) as { trip?: unknown; itinerary?: unknown };
  const t = (r.trip ?? {}) as Record<string, unknown>;
  const i = (r.itinerary ?? {}) as Record<string, unknown>;

  const days = Math.max(1, Math.min(30, Math.round(Number(t.days) || 1)));
  const travelers = Math.max(
    1,
    Math.min(40, Math.round(Number(t.travelers) || 2))
  );

  // Brief is short, so if the model misses a destination we fall back to a
  // first-line snippet rather than failing the whole flow.
  const destinationRaw = typeof t.destination === "string" ? t.destination.trim() : "";
  const destination =
    destinationRaw.slice(0, 80) ||
    brief.trim().split(/[.,\n]/)[0].slice(0, 80) ||
    "Custom trip";

  const startDate =
    typeof t.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate)
      ? t.startDate
      : null;

  const budgetN = Number(t.budget);
  const budget = Number.isFinite(budgetN) && budgetN > 0 ? Math.round(budgetN) : null;

  const interests = Array.isArray(t.interests)
    ? (t.interests as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const notes = typeof t.notes === "string" ? t.notes.trim() : "";

  const trip: BriefTrip = {
    destination,
    days,
    travelers,
    startDate,
    budget,
    travelType: coerceTravelType(t.travelType),
    pace: coercePace(t.pace),
    hotelType: coerceHotelType(t.hotelType),
    interests,
    notes,
  };

  const summary = typeof i.summary === "string" ? i.summary.trim() : "";
  const rawDays = Array.isArray(i.days) ? i.days : [];
  const itineraryDays: ItineraryDay[] = Array.from({ length: days }, (_, idx) => {
    const d = (rawDays[idx] ?? {}) as Record<string, unknown>;
    const str = (k: string): string =>
      typeof d[k] === "string" ? (d[k] as string).trim() : "";
    const arr = (k: string): string[] =>
      Array.isArray(d[k])
        ? (d[k] as unknown[])
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    const title = str("title") || `Day ${idx + 1}`;
    return {
      title,
      summary: str("summary"),
      city: str("city") || null,
      hotel: str("hotel") || null,
      roomType: str("roomType") || null,
      mealPlan: str("mealPlan") || null,
      meals: inferMealsFromPlan(str("mealPlan")),
      foodNote: str("foodNote") || null,
      activities: arr("activities"),
      inclusions: arr("inclusions"),
      exclusions: arr("exclusions"),
      transferNote: str("transferNote") || null,
      notes: str("notes") || undefined,
    };
  });

  return {
    trip,
    itinerary: { summary, days: itineraryDays },
  };
}

/** Mock fallback when GEMINI_API_KEY isn't set — keeps dev flows working. */
function mockBriefResult(brief: string): BriefResult {
  const lower = brief.toLowerCase();
  const m = brief.match(/(\d+)\s*(?:n(?:ight)?s?|nights?)\s*(\d+)?\s*(?:d(?:ay)?s?)?/i);
  const guessDays =
    m && m[2]
      ? Math.min(30, Math.max(1, Number(m[2])))
      : m
        ? Math.min(30, Math.max(1, Number(m[1]) + 1))
        : 5;
  const dest =
    brief.trim().split(/[.,\n]/)[0].slice(0, 80) || "Custom trip";
  return {
    trip: {
      destination: dest,
      days: guessDays,
      travelers: 2,
      startDate: null,
      budget: null,
      travelType: lower.includes("honeymoon")
        ? "Honeymoon"
        : lower.includes("family")
          ? "Family"
          : "Family",
      pace: "Moderate",
      hotelType: "Standard",
      interests: [],
      notes: brief.trim(),
    },
    itinerary: {
      summary: `A ${guessDays}-day trip as outlined in the agent's brief.`,
      days: Array.from({ length: guessDays }, (_, i) => ({
        title: `Day ${i + 1}`,
        summary:
          "Itinerary draft — fill in details from the brief in the trip workspace.",
        activities: [],
      })),
    },
  };
}

export async function generateTripFromBriefAI(
  brief: string
): Promise<BriefResult> {
  const trimmed = brief.trim();
  if (trimmed.length === 0) {
    throw new Error("Brief is empty.");
  }
  if (!genai) {
    return mockBriefResult(trimmed);
  }
  try {
    const response = await genai.models.generateContent({
      model,
      contents: buildBriefPrompt(trimmed),
      config: {
        systemInstruction: BRIEF_SYSTEM,
        // Lower temperature than the inspire flow — we want faithful
        // extraction, not creative reinterpretation.
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw);
    return normalizeBriefResult(parsed, trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[gemini] brief-to-trip falling back to mock —", msg);
    return mockBriefResult(trimmed);
  }
}
