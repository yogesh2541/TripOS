"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTripFromBriefAction } from "@/server/actions/trips";

const PLACEHOLDER = `e.g. 4 nights / 5 days Shimla–Manali trip. 2N Shimla, 2N Manali. Pickup ex-Delhi by Swift Dzire, drop back to Delhi. Sightseeing: Day 1 Shimla local, Day 2 Jakhu temple, Day 3 Rohtang pass, Day 4 Solang valley, Day 5 Manikaran visit and head back to Delhi. Meal plan: breakfast + dinner included.`;

const MIN_LENGTH = 20;
const MAX_LENGTH = 4000;

export function TripBriefForm({
  contactId,
  contactName,
}: {
  contactId?: string | null;
  contactName?: string | null;
}) {
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmedLength = brief.trim().length;
  const tooShort = trimmedLength < MIN_LENGTH;
  const tooLong = trimmedLength > MAX_LENGTH;

  function submit() {
    setError(null);
    if (tooShort) {
      setError("Add a bit more detail — at least a destination and length.");
      return;
    }
    if (tooLong) {
      setError("Keep the brief under 4,000 characters.");
      return;
    }
    startTransition(async () => {
      try {
        await createTripFromBriefAction({
          brief,
          contactId: contactId ?? null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        if (msg.includes("NEXT_REDIRECT")) throw e;
        setError(msg);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {contactId && contactName && (
        <div className="mb-6 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-[6px] border border-line bg-paper px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted">
            For contact
            <span className="text-ink font-medium normal-case tracking-normal">
              {contactName}
            </span>
          </span>
        </div>
      )}

      <div className="rounded-lg border border-line bg-paper p-8 md:p-12 shadow-soft">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-[var(--on-dark)]" style={{ background: "linear-gradient(150deg, var(--gold), #B0863F)" }}>
            <Wand2 className="h-4 w-4" />
          </span>
          <p className="tc-eyebrow gold">
            Build to spec
          </p>
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-ink">
          Paste the full brief. We&apos;ll build it.
        </h2>
        <p className="mt-3 text-sm text-muted leading-relaxed max-w-prose">
          When you already know the day-by-day, the vehicle, the meal plan —
          skip the wizard. Write it naturally, exactly the way you&apos;d describe
          it to a colleague. We&apos;ll keep your details verbatim and never
          invent activities you didn&apos;t mention.
        </p>

        <div className="mt-8 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="trip-brief">Your brief</Label>
            <span
              className={`text-[10px] uppercase tracking-[0.18em] tabular-nums ${
                tooLong ? "text-bad" : "text-muted"
              }`}
            >
              {trimmedLength.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
            </span>
          </div>
          <Textarea
            id="trip-brief"
            rows={12}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={PLACEHOLDER}
            disabled={isPending}
            className="text-sm leading-relaxed font-mono"
          />
          <p className="text-xs text-muted">
            Tip: include the day split (e.g. &ldquo;2N Shimla / 2N Manali&rdquo;),
            specific sightseeing per day, transport, and meal plan. The more
            specifics, the more faithful the result.
          </p>
        </div>

        {error && (
          <p className="mt-6 text-sm text-bad animate-fade-in">{error}</p>
        )}

        <div className="mt-10 flex items-center justify-end">
          <Button
            variant="accent"
            onClick={submit}
            disabled={isPending || tooShort || tooLong}
            className="min-w-[220px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building your trip
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate from brief
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
