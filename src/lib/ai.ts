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

/** Translate hotel meal-plan shorthand (BB / HB / AP / AI / CP) into toggles. */
function inferMealsFromPlan(plan?: string | null): DayMeals {
  if (!plan) return {};
  const t = plan.trim().toUpperCase();
  // All-inclusive
  if (/\bAI\b|ALL.?INCLUSIVE/.test(t)) {
    return { breakfast: true, lunch: true, dinner: true };
  }
  // American Plan / Full board
  if (/\bAP\b|FULL.?BOARD|FB\b/.test(t)) {
    return { breakfast: true, lunch: true, dinner: true };
  }
  // Modified American Plan / Half board
  if (/\bMAP\b|HALF.?BOARD|\bHB\b/.test(t)) {
    return { breakfast: true, dinner: true };
  }
  // Continental Plan / Bed & Breakfast
  if (/\bCP\b|\bBB\b|B&B|BED.?AND.?BREAKFAST|BREAKFAST/.test(t)) {
    return { breakfast: true };
  }
  // EP / room-only
  if (/\bEP\b|ROOM.?ONLY|EUROPEAN.?PLAN/.test(t)) {
    return {};
  }
  return {};
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

const SYSTEM = `You are a senior luxury travel curator. You write calm, premium, evocative copy. Avoid clichés and exclamation marks. Be concise but vivid. When given specific facts (hotel names, activities, inclusions), you treat them as authoritative — never substitute, invent, or omit them. Your job is to write prose that wraps those facts gracefully.`;

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
- For days WITHOUT structured input, use your creative judgment based on the destination, pace, and interests.`;
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
      "activities": ["Specific place 1", "Specific experience 2", "..."],
      "foodNote": "Specific dining recommendation or meal-plan note (1 sentence).",
      "notes": "Logistics + insider tips: transfers, distances, what to carry, hidden gems."
    }
  ]
}

Produce exactly ${input.days} day(s).
For activities: list 3-6 SPECIFIC named places or experiences per day (e.g. "Sunset at Tanah Lot", not "see a temple"). Each item must be specific enough to Google.
Keep summary prose vivid but tight. No overpacking. Group nearby experiences. Mention rest where the pace warrants it.
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
