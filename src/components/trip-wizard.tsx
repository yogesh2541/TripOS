"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTripAction, type CreateTripInput } from "@/server/actions/trips";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "where", title: "Where to?" },
  { key: "route", title: "Your route" },
  { key: "activities", title: "Activities by day" },
  { key: "who", title: "Travellers" },
] as const;

const TRAVEL_TYPES: CreateTripInput["travelType"][] = [
  "Luxury",
  "Honeymoon",
  "Family",
  "Budget",
];

// Sensible defaults — the wizard no longer asks for these; they can still be
// fine-tuned later in the trip workspace.
const DEFAULT_HOTEL: CreateTripInput["hotelType"] = "Boutique";
const DEFAULT_PACE: CreateTripInput["pace"] = "Moderate";

// Stored value embeds both a label and the industry code so the AI prompt and
// inferMealsFromPlan() both read it cleanly.
const MEAL_PLANS = [
  { value: "Room only (EP)", short: "Room only" },
  { value: "Breakfast (CP)", short: "Breakfast" },
  { value: "Breakfast + dinner (MAP)", short: "Half board" },
  { value: "All meals (AP)", short: "Full board" },
  { value: "All-inclusive (AI)", short: "All-inclusive" },
] as const;
const DEFAULT_MEAL = "Breakfast (CP)";

let _id = 0;
const uid = () => `r${_id++}`;

type Stop = { id: string; city: string; nights: number; mealPlan: string };
type DayActivity = { id: string; day: number; text: string };

type PrefillFromLead = {
  contactId: string;
  leadName: string;
  destination?: string | null;
  startDate?: string | null;
  days?: number | null;
  travelers?: number | null;
  budget?: number | null;
  notes?: string | null;
};

export function TripWizard({ prefill }: { prefill?: PrefillFromLead }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // --- form state ---
  const [destination, setDestination] = useState(prefill?.destination ?? "");
  const [travelType, setTravelType] =
    useState<CreateTripInput["travelType"]>("Luxury");
  const [startDate, setStartDate] = useState<string>(prefill?.startDate ?? "");

  const [stops, setStops] = useState<Stop[]>([
    { id: uid(), city: "", nights: 2, mealPlan: DEFAULT_MEAL },
  ]);

  const [activities, setActivities] = useState<DayActivity[]>([]);
  const [draftActivity, setDraftActivity] = useState("");
  const [draftDay, setDraftDay] = useState(1);

  const [adults, setAdults] = useState(prefill?.travelers ?? 2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState("");
  const [budget, setBudget] = useState<number | null>(prefill?.budget ?? null);
  const [notes, setNotes] = useState(prefill?.notes ?? "");

  // --- derived: route → day map (one entry per day incl. departure) ---
  const dayMap = useMemo(() => {
    const map: { city: string; mealPlan: string; departure?: boolean }[] = [];
    for (const s of stops) {
      const n = Math.max(0, Math.floor(s.nights));
      for (let i = 0; i < n; i++)
        map.push({ city: s.city.trim(), mealPlan: s.mealPlan });
    }
    if (map.length > 0) {
      const last = stops[stops.length - 1];
      map.push({ city: last.city.trim(), mealPlan: last.mealPlan, departure: true });
    }
    return map;
  }, [stops]);

  const totalNights = useMemo(
    () => stops.reduce((s, x) => s + Math.max(0, Math.floor(x.nights)), 0),
    [stops]
  );
  const totalDays = dayMap.length; // nights + 1 (departure)

  // --- stop helpers ---
  function addStop() {
    setStops((s) => [...s, { id: uid(), city: "", nights: 2, mealPlan: DEFAULT_MEAL }]);
  }
  function removeStop(id: string) {
    setStops((s) => (s.length > 1 ? s.filter((x) => x.id !== id) : s));
  }
  function updateStop(id: string, p: Partial<Stop>) {
    setStops((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  function addActivity() {
    const text = draftActivity.trim();
    if (!text) return;
    const day = Math.min(Math.max(1, draftDay), Math.max(1, totalDays));
    setActivities((a) => [...a, { id: uid(), day, text }]);
    setDraftActivity("");
  }
  function removeActivity(id: string) {
    setActivities((a) => a.filter((x) => x.id !== id));
  }

  function next() {
    setError(null);
    if (step === 0 && destination.trim().length < 2) {
      setError("Tell us the country or region you're heading to.");
      return;
    }
    if (step === 1) {
      if (stops.some((s) => s.city.trim().length < 2)) {
        setError("Give every stop a city name.");
        return;
      }
      if (totalNights < 1) {
        setError("Add at least one night.");
        return;
      }
      if (totalDays > 30) {
        setError("That's a long one — keep it under 30 days.");
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function prev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    setError(null);
    if (adults + children < 1) {
      setError("Add at least one traveller.");
      return;
    }

    const dayPlans = dayMap.map((d, i) => ({
      city: d.city || null,
      mealPlan: d.mealPlan || null,
      activities: activities
        .filter((a) => a.day === i + 1)
        .map((a) => a.text.trim())
        .filter(Boolean),
    }));

    const partyBits = [`${adults} adult${adults === 1 ? "" : "s"}`];
    if (children > 0) {
      partyBits.push(
        `${children} child${children === 1 ? "" : "ren"}${
          childAges.trim() ? ` (ages ${childAges.trim()})` : ""
        }`
      );
    }
    const routeLine = stops
      .filter((s) => s.city.trim())
      .map((s) => `${s.nights}N ${s.city.trim()}`)
      .join(" · ");
    const composedNotes = [
      `Party: ${partyBits.join(", ")}.`,
      routeLine ? `Route: ${routeLine}.` : "",
      notes.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    const payload: CreateTripInput = {
      destination: destination.trim(),
      days: Math.max(1, totalDays),
      travelers: adults + children,
      startDate: startDate || null,
      budget: budget,
      travelType,
      pace: DEFAULT_PACE,
      hotelType: DEFAULT_HOTEL,
      interests: [],
      notes: composedNotes,
      contactId: prefill?.contactId ?? null,
      dayPlans,
    };

    startTransition(async () => {
      try {
        await createTripAction(payload);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        if (msg.includes("NEXT_REDIRECT")) throw e;
        setError(msg);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {prefill && (
        <div className="mb-6 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-[6px] border border-line bg-paper px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted">
            For contact
            <span className="text-ink font-medium normal-case tracking-normal">
              {prefill.leadName}
            </span>
          </span>
        </div>
      )}
      <Stepper current={step} total={STEPS.length} />

      <div className="mt-10 rounded-lg border border-line bg-paper p-8 md:p-12 shadow-soft">
        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[step].key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="tc-eyebrow gold">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-ink">
              {STEPS[step].title}
            </h2>

            <div className="mt-8 space-y-6">
              {/* STEP 0 — destination + type + date */}
              {step === 0 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Country or region</Label>
                    <Input
                      id="destination"
                      placeholder="e.g. Thailand"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      autoFocus
                    />
                    <p className="text-xs text-muted pt-1">
                      The big picture — you&apos;ll add the cities next.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Travel type</Label>
                    <Pills
                      options={TRAVEL_TYPES}
                      value={travelType}
                      onChange={(v) =>
                        setTravelType(v as CreateTripInput["travelType"])
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date (optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* STEP 1 — route: city + nights + meal plan */}
              {step === 1 && (
                <>
                  <div className="space-y-3">
                    {stops.map((s, i) => (
                      <div
                        key={s.id}
                        className="rounded-[10px] border border-line bg-paper-2 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-gold-soft text-gold-deep">
                            <MapPin className="h-3.5 w-3.5" />
                          </span>
                          <Input
                            placeholder={`City ${i + 1} — e.g. ${
                              i === 0 ? "Bangkok" : "Pattaya"
                            }`}
                            value={s.city}
                            onChange={(e) => updateStop(s.id, { city: e.target.value })}
                            className="flex-1"
                          />
                          {stops.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStop(s.id)}
                              className="h-9 w-9 shrink-0 rounded-[8px] border border-line text-muted hover:text-bad hover:border-bad-soft transition-colors flex items-center justify-center"
                              aria-label="Remove stop"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={30}
                              value={s.nights}
                              onChange={(e) =>
                                updateStop(s.id, {
                                  nights: Number(e.target.value || 0),
                                })
                              }
                              className="w-20 text-center tabular-nums"
                              aria-label="Nights"
                            />
                            <span className="text-sm text-muted">
                              night{s.nights === 1 ? "" : "s"}
                            </span>
                          </div>
                          <Select
                            value={s.mealPlan}
                            onValueChange={(v) => updateStop(s.id, { mealPlan: v })}
                          >
                            <SelectTrigger className="text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MEAL_PLANS.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                  {m.short}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addStop}>
                    <Plus className="h-3.5 w-3.5" />
                    Add another city
                  </Button>
                  {totalNights > 0 && (
                    <p className="text-sm text-muted">
                      <span className="font-mono tabular-nums text-ink font-medium">
                        {totalNights}
                      </span>{" "}
                      night{totalNights === 1 ? "" : "s"} ·{" "}
                      <span className="font-mono tabular-nums text-ink font-medium">
                        {totalDays}
                      </span>{" "}
                      days{" "}
                      <span className="text-faint">(incl. departure day)</span>
                    </p>
                  )}
                </>
              )}

              {/* STEP 2 — activities by day */}
              {step === 2 && (
                <>
                  <p className="text-sm text-muted -mt-2">
                    Add things they want to do and pin each to a day. We&apos;ll
                    build the day around them — anything you skip, we fill in.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="e.g. Floating market tour"
                      value={draftActivity}
                      onChange={(e) => setDraftActivity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addActivity();
                        }
                      }}
                      className="flex-1"
                    />
                    <Select
                      value={String(Math.min(Math.max(1, draftDay), totalDays || 1))}
                      onValueChange={(v) => setDraftDay(Number(v))}
                    >
                      <SelectTrigger className="sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: totalDays }).map((_, i) => (
                          <SelectItem key={i} value={String(i + 1)}>
                            {dayLabel(i + 1, dayMap)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={addActivity}>
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {Array.from({ length: totalDays }).map((_, i) => {
                      const dayActs = activities.filter((a) => a.day === i + 1);
                      if (dayActs.length === 0) return null;
                      return (
                        <div key={i}>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-deep mb-2">
                            {dayLabel(i + 1, dayMap)}
                          </p>
                          <div className="space-y-1.5">
                            {dayActs.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-2 rounded-[8px] border border-line bg-paper-2 px-3 py-2"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-gold-deep shrink-0" />
                                <span className="flex-1 text-sm text-ink">
                                  {a.text}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeActivity(a.id)}
                                  className="text-muted hover:text-bad"
                                  aria-label="Remove activity"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {activities.length === 0 && (
                      <p className="text-sm text-faint italic">
                        No must-dos yet — that&apos;s fine, we&apos;ll suggest a
                        full day-by-day plan.
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* STEP 3 — travellers */}
              {step === 3 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="adults">Adults</Label>
                      <Input
                        id="adults"
                        type="number"
                        min={1}
                        max={40}
                        value={adults}
                        onChange={(e) => setAdults(Number(e.target.value || 0))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="children">Children</Label>
                      <Input
                        id="children"
                        type="number"
                        min={0}
                        max={20}
                        value={children}
                        onChange={(e) =>
                          setChildren(Number(e.target.value || 0))
                        }
                      />
                    </div>
                  </div>
                  {children > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="childAges">Children&apos;s ages (optional)</Label>
                      <Input
                        id="childAges"
                        placeholder="e.g. 7, 10"
                        value={childAges}
                        onChange={(e) => setChildAges(e.target.value)}
                      />
                      <p className="text-xs text-muted pt-1">
                        Helps us tailor kid-friendly picks and room configs.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget (₹, optional)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min={0}
                      placeholder="e.g. 250000"
                      value={budget ?? ""}
                      onChange={(e) =>
                        setBudget(
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Special notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Anniversary, vegetarian-only, mobility needs, anything we should know…"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-6 text-sm text-bad animate-fade-in">{error}</p>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Button variant="ghost" onClick={prev} disabled={step === 0 || isPending}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={isPending}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="accent"
              onClick={submit}
              disabled={isPending}
              className="min-w-[200px]"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Crafting your trip
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate itinerary
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function dayLabel(
  day: number,
  dayMap: { city: string; departure?: boolean }[]
): string {
  const entry = dayMap[day - 1];
  const city = entry?.city?.trim();
  const tail = city ? ` · ${city}` : "";
  const dep = entry?.departure ? " (departure)" : "";
  return `Day ${day}${tail}${dep}`;
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {options.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "h-11 rounded-[10px] border text-sm transition-all",
            value === t
              ? "border-inkwash bg-inkwash text-[var(--on-dark)] shadow-soft"
              : "border-line bg-paper text-ink hover:border-[var(--gold-line)]"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2 rounded-full transition-all",
            i <= current ? "bg-gold-deep w-10" : "bg-line w-2"
          )}
        />
      ))}
    </div>
  );
}
