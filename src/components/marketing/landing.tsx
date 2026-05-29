import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CreditCard,
  FileText,
  MessageCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { PLANS, PRICING_ORDER, TRIAL_DAYS, formatPlanPrice } from "@/lib/plans";

export function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <ClosingCta />
    </>
  );
}

// --- hero -----------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,169,106,0.12),transparent_55%)]" />
      <div className="relative mx-auto max-w-6xl px-5 md:px-10 pt-20 md:pt-28 pb-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-[6px] border border-[var(--gold-line)] bg-gold-soft px-3.5 py-1.5 text-[11px] uppercase tracking-[0.2em] text-gold-deep">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered travel CRM
        </span>
        <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[0.98] tracking-tight text-ink">
          Run your travel agency
          <br className="hidden md:block" /> on one beautiful platform.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-ink/75 leading-relaxed">
          From the first inquiry to a paid booking — capture leads, generate
          AI itineraries, send branded proposals on WhatsApp, collect payments,
          and run operations. Everything your agency needs, in one place.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-[8px] bg-inkwash px-6 py-3 text-sm font-medium text-[var(--on-dark)] hover:bg-inkwash/90 transition-colors shadow-soft"
          >
            Start your {TRIAL_DAYS}-day free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-paper px-6 py-3 text-sm font-medium text-ink hover:border-line-2 transition-colors"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">
          No card required · Set up in minutes · Made for Indian agencies
        </p>
      </div>
    </section>
  );
}

// --- features -------------------------------------------------------------

const FEATURES = [
  {
    icon: Wand2,
    title: "AI itineraries",
    body: "Type a brief or a few details — get a polished, day-by-day itinerary you can shape, in seconds.",
  },
  {
    icon: FileText,
    title: "Branded proposals & PDFs",
    body: "White-labelled proposals with your logo, themes and customer-safe pricing. Share a link or a real PDF.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp built in",
    body: "Send proposals, invoices and reminders over WhatsApp Cloud API — with templates and automations.",
  },
  {
    icon: CreditCard,
    title: "Quotes, invoices & payments",
    body: "Build quotes, issue GST-compliant invoices, and collect payments online with auto-reconciliation.",
  },
  {
    icon: Building2,
    title: "Operations & vendors",
    body: "Assign vendors, generate vouchers, track confirmations and tasks — your whole back office, organised.",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    body: "Conversion funnel, revenue trend, margins, agent performance and lead-source ROI at a glance.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 md:px-10 py-20">
      <div className="text-center mb-12">
        <p className="tc-eyebrow gold">Everything in one place</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl text-ink">
          Built for how agencies actually work
        </h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-line bg-paper p-6 shadow-soft hover:shadow-lift transition-all"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-paper-2 border border-line text-gold-deep">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-xl text-ink">{f.title}</h3>
            <p className="mt-2 text-sm text-ink/75 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- how it works ---------------------------------------------------------

const STEPS = [
  {
    n: "01",
    title: "Capture the inquiry",
    body: "Log a lead from Instagram, a referral, a walk-in — anywhere. Track it through your pipeline.",
  },
  {
    n: "02",
    title: "Craft the trip",
    body: "Generate an AI itinerary from a brief, refine it, and build a priced quote in minutes.",
  },
  {
    n: "03",
    title: "Send the proposal",
    body: "Share a beautiful, branded proposal on WhatsApp. The customer accepts online.",
  },
  {
    n: "04",
    title: "Collect & operate",
    body: "Take payment online, issue the GST invoice, assign vendors and run the trip to completion.",
  },
];

function HowItWorks() {
  return (
    <section className="bg-inkwash text-[var(--on-dark)]">
      <div className="mx-auto max-w-6xl px-5 md:px-10 py-20">
        <div className="text-center mb-12">
          <p className="tc-eyebrow gold">From inquiry to booking</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">
            One flow, start to finish
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="font-display text-3xl text-gold-deep font-mono tabular-nums">{s.n}</p>
              <h3 className="mt-3 font-display text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--on-dark)]/70 leading-relaxed">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- pricing teaser -------------------------------------------------------

function PricingTeaser() {
  return (
    <section className="mx-auto max-w-5xl px-5 md:px-10 py-20">
      <div className="text-center mb-12">
        <p className="tc-eyebrow gold">Simple pricing</p>
        <h2 className="mt-3 font-display text-4xl md:text-5xl text-ink">
          Plans that grow with you
        </h2>
        <p className="mt-3 text-sm text-muted">
          Start free for {TRIAL_DAYS} days. No card required.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {PRICING_ORDER.map((tier) => {
          const def = PLANS[tier];
          const featured = tier === "PRO";
          return (
            <div
              key={tier}
              className={
                "rounded-lg border bg-paper p-6 shadow-soft flex flex-col " +
                (featured
                  ? "border-[var(--gold-line)] ring-1 ring-[var(--gold-line)]/40"
                  : "border-line")
              }
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-ink">{def.name}</h3>
                {featured && (
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-gold-soft border border-[var(--gold-line)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-gold-deep">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{def.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-4xl text-ink font-mono tabular-nums">
                  {formatPlanPrice(def.priceMonthly)}
                </span>
                <span className="text-sm text-muted"> / month</span>
              </p>
              <ul className="mt-5 space-y-2 flex-1">
                {def.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-ink/85"
                  >
                    <Check className="h-4 w-4 text-ok mt-0.5 shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  "mt-6 inline-flex items-center justify-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-medium transition-colors " +
                  (featured
                    ? "bg-inkwash text-[var(--on-dark)] hover:bg-inkwash/90"
                    : "border border-line text-ink hover:border-line-2")
                }
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/pricing" className="text-ink underline">
          Compare plans in detail
        </Link>
      </p>
    </section>
  );
}

// --- closing CTA ----------------------------------------------------------

function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 md:px-10 pb-24">
      <div className="rounded-lg bg-inkwash text-[var(--on-dark)] px-8 py-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,106,0.18),transparent_60%)]" />
        <div className="relative">
          <h2 className="font-display text-4xl md:text-5xl">
            Ready to craft better trips?
          </h2>
          <p className="mt-4 text-[var(--on-dark)]/75 max-w-xl mx-auto">
            Join agencies running their entire business on TripCraft. Your free
            {" "}
            {TRIAL_DAYS}-day trial starts the moment you sign up.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-[8px] bg-paper px-6 py-3 text-sm font-medium text-ink hover:bg-paper-2 transition-colors"
          >
            Start your free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
