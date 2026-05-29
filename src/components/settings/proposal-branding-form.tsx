"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ImageIcon,
  Loader2,
  Palette,
  Sparkles,
  Stamp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  saveProposalBrandingAction,
  type ProposalBrandingInput,
} from "@/server/actions/proposal-branding";
import { PROPOSAL_THEMES, COVER_STYLES } from "@/lib/proposal-branding";

type Theme = (typeof PROPOSAL_THEMES)[number];
type Cover = (typeof COVER_STYLES)[number];

const THEME_INFO: Record<
  Theme,
  { name: string; tagline: string; swatch: { bg: string; fg: string; accent: string } }
> = {
  classic: {
    name: "Classic",
    tagline: "Navy hero, gold accents, display fonts. The default look.",
    swatch: { bg: "#1A2238", fg: "#FAF7F0", accent: "#C8A96A" },
  },
  editorial: {
    name: "Editorial",
    tagline: "Light, magazine-style layout with lots of breathing room.",
    swatch: { bg: "#FAF7F0", fg: "#1A2238", accent: "#C8A96A" },
  },
  minimal: {
    name: "Minimal",
    tagline: "Monochrome, no cover photo, clean sans typography.",
    swatch: { bg: "#FFFFFF", fg: "#1A2238", accent: "#1A2238" },
  },
};

const COVER_INFO: Record<Cover, { name: string; tagline: string }> = {
  photo: { name: "Cover photo", tagline: "Use the itinerary's hero image." },
  gradient: { name: "Gradient", tagline: "Solid colour wash with depth." },
  solid: { name: "Solid", tagline: "Flat brand colour, no imagery." },
};

export type ProposalBrandingFormProps = {
  initial: {
    theme: Theme;
    accentColor: string | null;
    coverStyle: Cover;
    showAtAGlance: boolean;
    showInclusions: boolean;
    showTerms: boolean;
    signatureNote: string | null;
    repeatLogo: boolean;
  };
  agencyName: string;
  logoUrl: string | null;
  canEdit: boolean;
};

export function ProposalBrandingForm({
  initial,
  agencyName,
  logoUrl,
  canEdit,
}: ProposalBrandingFormProps) {
  const [form, setForm] = useState<ProposalBrandingFormProps["initial"]>(initial);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    startTransition(async () => {
      try {
        await saveProposalBrandingAction(form as ProposalBrandingInput);
        toast.success("Proposal branding saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  const accent = form.accentColor || "#C8A96A";

  return (
    <div className="space-y-8">
      {/* Live mini-preview ----------------------------------------------- */}
      <section className="rounded-lg border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold-deep">
            Live preview
          </p>
          <span
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {THEME_INFO[form.theme].name}
          </span>
        </div>
        <ThemePreview
          theme={form.theme}
          accent={accent}
          agencyName={agencyName}
          logoUrl={logoUrl}
        />
      </section>

      {/* Theme picker --------------------------------------------------- */}
      <section className="space-y-3">
        <SectionHeading
          icon={<Sparkles className="h-3.5 w-3.5" />}
          title="Template"
          hint="The overall look of the customer-facing proposal."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {PROPOSAL_THEMES.map((t) => {
            const info = THEME_INFO[t];
            const active = form.theme === t;
            return (
              <button
                key={t}
                type="button"
                disabled={!canEdit}
                onClick={() => update("theme", t)}
                className={`relative text-left rounded-lg border p-4 transition-all ${
                  active
                    ? "border-[var(--gold-line)] ring-2 ring-[var(--gold-line)]/20 bg-paper shadow-soft"
                    : "border-line bg-paper hover:border-[var(--gold-line)]/60 hover:shadow-soft"
                } disabled:opacity-60`}
              >
                <div
                  className="h-16 rounded-[8px] mb-3 overflow-hidden flex items-end p-2"
                  style={{ backgroundColor: info.swatch.bg }}
                >
                  <span
                    className="text-[9px] uppercase tracking-[0.22em]"
                    style={{ color: info.swatch.accent }}
                  >
                    Travel proposal
                  </span>
                </div>
                <p className="font-display text-lg text-ink">{info.name}</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {info.tagline}
                </p>
                {active && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-[6px] bg-inkwash text-[var(--on-dark)]">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Accent + cover ------------------------------------------------- */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <SectionHeading
            icon={<Palette className="h-3.5 w-3.5" />}
            title="Accent colour"
            hint="Used for eyebrows, dividers, and price highlights."
          />
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.accentColor || "#C8A96A"}
              onChange={(e) => update("accentColor", e.target.value)}
              disabled={!canEdit}
              className="h-11 w-14 cursor-pointer rounded-[10px] border border-line bg-paper p-1 disabled:opacity-60"
              aria-label="Accent colour"
            />
            <Input
              value={form.accentColor ?? ""}
              onChange={(e) => update("accentColor", e.target.value || null)}
              placeholder="#C8A96A"
              disabled={!canEdit}
              className="font-mono uppercase tabular-nums"
              maxLength={9}
            />
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={!canEdit || form.accentColor === null}
              onClick={() => update("accentColor", null)}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeading
            icon={<ImageIcon className="h-3.5 w-3.5" />}
            title="Cover treatment"
            hint="How the top of the proposal renders."
          />
          <div className="grid gap-2">
            {COVER_STYLES.map((c) => {
              const info = COVER_INFO[c];
              const active = form.coverStyle === c;
              return (
                <button
                  key={c}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => update("coverStyle", c)}
                  className={`flex items-start justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors ${
                    active
                      ? "border-[var(--gold-line)] bg-paper-2"
                      : "border-line bg-paper hover:border-[var(--gold-line)]/60"
                  } disabled:opacity-60`}
                >
                  <span>
                    <span className="block text-sm text-ink font-medium">
                      {info.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {info.tagline}
                    </span>
                  </span>
                  {active && <Check className="h-4 w-4 text-gold-deep shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sections ------------------------------------------------------- */}
      <section className="space-y-3">
        <SectionHeading
          icon={<Stamp className="h-3.5 w-3.5" />}
          title="Sections"
          hint="Hide what isn't useful for your style of selling."
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <ToggleRow
            label="Trip at a glance"
            description="Per-day summary table near the top"
            checked={form.showAtAGlance}
            onChange={(v) => update("showAtAGlance", v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="What's included / excluded"
            description="Trip-level inclusions summary"
            checked={form.showInclusions}
            onChange={(v) => update("showInclusions", v)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Booking terms"
            description="From your invoice terms field"
            checked={form.showTerms}
            onChange={(v) => update("showTerms", v)}
            disabled={!canEdit}
          />
        </div>
        <div className="rounded-[10px] border border-line bg-paper-2 px-3.5 py-2.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.repeatLogo}
              onChange={(e) => update("repeatLogo", e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 mt-0.5 rounded border-line accent-[var(--gold-line)]"
            />
            <span>
              <span className="block text-sm text-ink font-medium">
                Stamp the agency logo on every section
              </span>
              <span className="block text-xs text-muted">
                Keeps your brand visible throughout the document — especially
                on the printed / PDF version.
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* Signature ----------------------------------------------------- */}
      <section className="space-y-2">
        <Label htmlFor="prop-signoff">Closing sign-off</Label>
        <Textarea
          id="prop-signoff"
          rows={3}
          value={form.signatureNote ?? ""}
          onChange={(e) => update("signatureNote", e.target.value || null)}
          placeholder="With warm regards,\nThe Wanderwarrior team"
          disabled={!canEdit}
        />
        <p className="text-xs text-muted">
          Shown above your contact block at the end of every proposal.
        </p>
      </section>

      {canEdit && (
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
          <Button onClick={submit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save proposal settings
          </Button>
        </div>
      )}
    </div>
  );
}

// --- helpers -------------------------------------------------------------

function SectionHeading({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-gold-deep">
        {icon}
        {title}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-[10px] border border-line bg-paper px-3.5 py-2.5 cursor-pointer ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--gold-line)]/60"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 mt-0.5 rounded border-line accent-[var(--gold-line)]"
      />
      <span>
        <span className="block text-sm text-navy font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

// Tiny inline mock of the proposal hero so the user sees their changes live.
function ThemePreview({
  theme,
  accent,
  agencyName,
  logoUrl,
}: {
  theme: Theme;
  accent: string;
  agencyName: string;
  logoUrl: string | null;
}) {
  if (theme === "minimal") {
    return (
      <div className="rounded-[10px] border border-line bg-paper p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={agencyName}
                className="h-7 w-7 rounded-full object-cover border border-line"
              />
            ) : (
              <span className="h-7 w-7 rounded-full bg-paper-2 border border-line" />
            )}
            <span className="text-xs text-ink font-medium">
              {agencyName}
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: accent }}>
            Proposal
          </span>
        </div>
        <p className="mt-4 font-display text-2xl text-ink leading-tight">
          Bali · 7 days
        </p>
        <p className="mt-1 text-xs text-muted">
          Crafted by {agencyName}
        </p>
      </div>
    );
  }

  if (theme === "editorial") {
    return (
      <div className="rounded-[10px] border border-line bg-[#FAF7F0] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={agencyName}
                className="h-8 w-8 rounded-full object-cover border border-line"
              />
            ) : (
              <span className="h-8 w-8 rounded-full bg-paper border border-line" />
            )}
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: accent }}>
              {agencyName}
            </span>
          </div>
        </div>
        <p className="mt-6 font-display text-3xl text-ink leading-tight">
          Bali — Seven days, two travellers
        </p>
        <div className="mt-3 h-px w-12" style={{ backgroundColor: accent }} />
        <p className="mt-3 text-xs text-muted italic">
          A curated journey through Ubud and Uluwatu.
        </p>
      </div>
    );
  }

  // classic (default)
  return (
    <div className="rounded-[10px] bg-[#1A2238] text-[var(--on-dark)] p-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(200,169,106,0.18),transparent_60%)]" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={agencyName}
              className="h-8 w-8 rounded-full object-cover border border-white/20"
            />
          ) : (
            <span className="h-8 w-8 rounded-full bg-white/10 border border-white/20" />
          )}
          <span
            className="text-[10px] uppercase tracking-[0.25em]"
            style={{ color: accent }}
          >
            Travel proposal · {agencyName}
          </span>
        </div>
      </div>
      <p className="relative mt-6 font-display text-3xl leading-tight">
        Bali
      </p>
      <p className="relative mt-2 text-xs text-[var(--on-dark)]/70">
        7 days · 2 travellers · Luxury
      </p>
    </div>
  );
}
