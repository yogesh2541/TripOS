"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTripAction, type CreateTripInput } from "@/server/actions/trips";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "where", title: "Where to?" },
  { key: "when", title: "When & how long" },
  { key: "who", title: "Who & how" },
  { key: "style", title: "Shape the experience" },
] as const;

const TRAVEL_TYPES: CreateTripInput["travelType"][] = [
  "Luxury",
  "Honeymoon",
  "Family",
  "Budget",
];

const PACES: CreateTripInput["pace"][] = ["Relaxed", "Moderate", "Packed"];

const HOTEL_TYPES: CreateTripInput["hotelType"][] = [
  "Boutique",
  "Luxury Resort",
  "Heritage",
  "Villa",
  "Standard",
];

const INTEREST_OPTIONS = [
  "Culture",
  "Food",
  "Nature",
  "Adventure",
  "Wellness",
  "Shopping",
  "History",
  "Nightlife",
  "Photography",
  "Art",
];

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

  const [form, setForm] = useState<CreateTripInput>({
    destination: prefill?.destination ?? "",
    days: prefill?.days ?? 5,
    travelers: prefill?.travelers ?? 2,
    startDate: prefill?.startDate ?? null,
    budget: prefill?.budget ?? null,
    travelType: "Luxury",
    pace: "Moderate",
    hotelType: "Boutique",
    interests: [],
    notes: prefill?.notes ?? null,
    contactId: prefill?.contactId ?? null,
  });

  function update<K extends keyof CreateTripInput>(
    key: K,
    value: CreateTripInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleInterest(name: string) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(name)
        ? f.interests.filter((i) => i !== name)
        : [...f.interests, name],
    }));
  }

  function next() {
    setError(null);
    if (step === 0 && form.destination.trim().length < 2) {
      setError("Tell us where you're going.");
      return;
    }
    if (step === 1 && (!form.days || form.days < 1)) {
      setError("Add at least one day.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createTripAction(form);
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
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            For contact
            <span className="text-navy font-medium normal-case tracking-normal">
              {prefill.leadName}
            </span>
          </span>
        </div>
      )}
      <Stepper current={step} total={STEPS.length} />

      <div className="mt-10 rounded-3xl border border-line bg-white p-8 md:p-12 shadow-soft">
        <AnimatePresence mode="wait">
          <motion.div
            key={STEPS[step].key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-sand-600">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl text-navy">
              {STEPS[step].title}
            </h2>

            <div className="mt-8 space-y-6">
              {step === 0 && (
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination</Label>
                  <Input
                    id="destination"
                    placeholder="e.g. Udaipur, Rajasthan"
                    value={form.destination}
                    onChange={(e) => update("destination", e.target.value)}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground pt-1">
                    A city, region or country — we'll handle the rest.
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="days">Number of days</Label>
                    <Input
                      id="days"
                      type="number"
                      min={1}
                      max={30}
                      value={form.days}
                      onChange={(e) =>
                        update("days", Number(e.target.value || 0))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date (optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={form.startDate ?? ""}
                      onChange={(e) =>
                        update("startDate", e.target.value || null)
                      }
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="travelers">Travelers</Label>
                    <Input
                      id="travelers"
                      type="number"
                      min={1}
                      max={40}
                      value={form.travelers}
                      onChange={(e) =>
                        update("travelers", Number(e.target.value || 0))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget (₹, optional)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min={0}
                      placeholder="e.g. 250000"
                      value={form.budget ?? ""}
                      onChange={(e) =>
                        update(
                          "budget",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label>Travel type</Label>
                    <Pills
                      options={TRAVEL_TYPES}
                      value={form.travelType}
                      onChange={(v) =>
                        update("travelType", v as CreateTripInput["travelType"])
                      }
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Pace</Label>
                    <Pills
                      options={PACES}
                      value={form.pace}
                      onChange={(v) =>
                        update("pace", v as CreateTripInput["pace"])
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hotel category</Label>
                    <Pills
                      options={HOTEL_TYPES}
                      value={form.hotelType}
                      onChange={(v) =>
                        update("hotelType", v as CreateTripInput["hotelType"])
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Interests</Label>
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_OPTIONS.map((i) => {
                        const active = form.interests.includes(i);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleInterest(i)}
                            className={cn(
                              "h-9 px-4 rounded-full border text-sm transition-all",
                              active
                                ? "border-navy bg-navy text-ivory"
                                : "border-line bg-white text-navy hover:border-sand"
                            )}
                          >
                            {i}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Special notes (optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Anniversary trip, vegetarian-only, mobility needs, anything we should know…"
                      rows={3}
                      value={form.notes ?? ""}
                      onChange={(e) =>
                        update("notes", e.target.value || null)
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {error && (
          <p className="mt-6 text-sm text-red-600 animate-fade-in">{error}</p>
        )}

        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={step === 0 || isPending}
          >
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
            "h-11 rounded-2xl border text-sm transition-all",
            value === t
              ? "border-navy bg-navy text-ivory shadow-soft"
              : "border-line bg-white text-navy hover:border-sand"
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
            i <= current ? "bg-navy w-10" : "bg-line w-2"
          )}
        />
      ))}
    </div>
  );
}
