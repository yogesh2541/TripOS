"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  ListChecks,
  MessageCircle,
  Route,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "tripos:welcome:";

type Slide = {
  icon: typeof Compass;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: Compass,
    title: "Welcome to TripCraft",
    body: "Your whole agency in one place — from the first inquiry to a paid, fully-operated trip. Here's the 60-second tour.",
  },
  {
    icon: Route,
    title: "One flow, start to finish",
    body: "Capture a contact → craft a trip → send a branded proposal → collect payment → run operations. Each step lives a click away in the left sidebar.",
  },
  {
    icon: Wand2,
    title: "AI does the heavy lifting",
    body: "Generate a full day-by-day itinerary from a short brief, then shape it. Build a priced quote and a polished, white-labelled proposal in minutes.",
  },
  {
    icon: MessageCircle,
    title: "Reach customers on WhatsApp",
    body: "Send proposals, invoices, reminders and payment links over WhatsApp — and get paid online, recorded against the booking automatically.",
  },
  {
    icon: ListChecks,
    title: "Let's get you set up",
    body: "There's a short checklist on your dashboard — add your logo, GSTIN and first contact. You can replay this tour anytime from Help & guides.",
  },
];

export function WelcomeWalkthrough({
  userId,
  firstName,
  forceOpen = false,
}: {
  userId: string;
  firstName?: string | null;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_PREFIX + userId);
      if (seen !== "1") setOpen(true);
    } catch {
      // localStorage unavailable — don't force the tour.
    }
  }, [userId, forceOpen]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function finish() {
    try {
      localStorage.setItem(STORAGE_PREFIX + userId, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) return null;

  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;
  const title =
    isFirst && firstName ? `Welcome, ${firstName}` : slide.title;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-inkwash/60 backdrop-blur-sm"
        onClick={finish}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-lg border border-line bg-paper shadow-pop overflow-hidden">
        <button
          onClick={finish}
          className="absolute top-4 right-4 z-10 rounded-[6px] p-1.5 text-muted hover:bg-paper-2 hover:text-ink transition-colors"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Visual top */}
        <div className="relative bg-inkwash px-8 pt-12 pb-10 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,169,106,0.22),transparent_60%)]" />
          <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-[10px] bg-[var(--on-dark)]/10 border border-[var(--on-dark)]/15 text-gold-deep">
            <Icon className="h-7 w-7" />
          </span>
        </div>

        {/* Content */}
        <div className="px-8 py-7 text-center">
          <p className="tc-eyebrow gold">
            Step {step + 1} of {SLIDES.length}
          </p>
          <h2 className="mt-2 font-display text-3xl text-ink leading-tight">
            {title}
          </h2>
          <p className="mt-3 text-sm text-ink/75 leading-relaxed max-w-sm mx-auto">
            {slide.body}
          </p>

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-navy" : "w-1.5 bg-line"
                )}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="mt-7 flex items-center justify-between gap-3">
            {isFirst ? (
              <button
                onClick={finish}
                className="text-sm text-muted-foreground hover:text-navy transition-colors"
              >
                Skip tour
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-navy transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {isLast ? (
              <button
                onClick={finish}
                className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-medium text-ivory hover:bg-navy/90 transition-colors"
              >
                Start exploring
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => Math.min(SLIDES.length - 1, s + 1))}
                className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-medium text-ivory hover:bg-navy/90 transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
