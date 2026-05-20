"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Coffee,
  Copy,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Map,
  MapPin,
  Moon,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Trash2,
  UtensilsCrossed,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ChipInput } from "@/components/ui/chip-input";
import { ImageUpload } from "@/components/ui/image-upload";
import { PillToggle } from "@/components/ui/pill-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentInlineCard } from "@/components/segments/segment-card";
import {
  insertDayAction,
  moveDayAction,
  regenerateItineraryAction,
  regenerateOneDayAction,
  removeDayAction,
  saveItineraryAction,
  suggestActivitiesAction,
} from "@/server/actions/itineraries";
import { readDay, type DayMeals, type ItineraryContent, type ItineraryDay } from "@/lib/ai";
import type { TravelSegment } from "@prisma/client";
import { cn } from "@/lib/utils";

type View = "normal" | "detailed";

type Props = {
  tripId: string;
  destination: string;
  initial: ItineraryContent | null;
  segments?: TravelSegment[];
  /** Trip start date — when present we display absolute dates per day. */
  tripStartDate?: string | null;
};

export function ItineraryEditor({
  tripId,
  destination,
  initial,
  segments = [],
  tripStartDate = null,
}: Props) {
  const router = useRouter();
  // Upgrade incoming days through readDay() so legacy fields render naturally.
  const [content, setContent] = useState<ItineraryContent | null>(() =>
    initial
      ? { ...initial, days: initial.days.map((d) => readDay(d)) }
      : null
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isRegenerating, startRegen] = useTransition();
  const [view, setView] = useState<View>("normal");

  const startDate = useMemo(
    () => (tripStartDate ? new Date(tripStartDate) : null),
    [tripStartDate]
  );

  function updateDay(index: number, day: ItineraryDay) {
    if (!content) return;
    setContent({
      ...content,
      days: content.days.map((d, i) => (i === index ? day : d)),
    });
  }

  function updateSummary(summary: string) {
    if (!content) return;
    setContent({ ...content, summary });
  }

  function save() {
    if (!content) return;
    startSave(async () => {
      await saveItineraryAction(tripId, content);
      setSavedAt(new Date().toLocaleTimeString());
      toast.success("Itinerary saved");
    });
  }

  function regenerate() {
    startRegen(async () => {
      await regenerateItineraryAction(tripId);
      window.location.reload();
    });
  }

  if (!content) {
    return (
      <EmptyItinerary
        destination={destination}
        onGenerate={regenerate}
        isGenerating={isRegenerating}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-600">
            Itinerary
          </p>
          <h2 className="font-display text-3xl text-navy">{destination}</h2>
        </div>
        <div className="flex items-center gap-2 pt-2 flex-shrink-0">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Saved {savedAt}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
          <Button size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PillToggle
          options={[
            { value: "normal", label: "Normal itinerary" },
            { value: "detailed", label: "Detailed itinerary" },
          ]}
          value={view}
          onChange={(v) => setView(v)}
        />
        <p className="text-xs text-muted-foreground">
          {view === "normal"
            ? "Compact view — title, summary, activities, stay & meals."
            : "Full view — adds inclusions, exclusions, transfers, image, food note and internal notes."}
        </p>
      </div>

      {/* Trip-level header */}
      <div className="rounded-2xl border border-line bg-white shadow-soft p-6 md:p-8 space-y-5">
        <div>
          <Label htmlFor="trip-summary">Trip overview</Label>
          <Textarea
            id="trip-summary"
            value={content.summary}
            onChange={(e) => updateSummary(e.target.value)}
            rows={3}
            className="mt-2 border-0 bg-ivory/60"
            placeholder="A two-sentence pitch of the trip — sets the mood for the whole proposal."
          />
        </div>
        {view === "detailed" && (
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <ImageIcon className="h-3 w-3" />
              Cover image
            </Label>
            <ImageUpload
              value={content.coverImageUrl}
              onChange={(url) =>
                setContent((c) => (c ? { ...c, coverImageUrl: url } : c))
              }
              height="h-40"
              label="Click or drop a cover image"
            />
          </div>
        )}
      </div>

      {/* Day cards */}
      <div className="space-y-5">
        {content.days.map((day, i) => (
          <div key={i}>
            <DayCard
              tripId={tripId}
              day={day}
              index={i}
              totalDays={content.days.length}
              previousDay={i > 0 ? content.days[i - 1] : undefined}
              onChange={(d) => updateDay(i, d)}
              segments={segments.filter((s) => s.dayNumber === i + 1)}
              view={view}
              startDate={startDate}
            />
            <InsertDayButton tripId={tripId} position={i + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day card
// ---------------------------------------------------------------------------

function DayCard({
  tripId,
  day,
  index,
  totalDays,
  previousDay,
  onChange,
  segments = [],
  view,
  startDate,
}: {
  tripId: string;
  day: ItineraryDay;
  index: number;
  totalDays: number;
  previousDay?: ItineraryDay;
  onChange: (d: ItineraryDay) => void;
  segments?: TravelSegment[];
  view: View;
  startDate: Date | null;
}) {
  const router = useRouter();
  const [isRewriting, startRewrite] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [isSuggesting, startSuggest] = useTransition();

  function patch<K extends keyof ItineraryDay>(key: K, value: ItineraryDay[K]) {
    onChange({ ...day, [key]: value });
  }

  function rewriteDay() {
    startRewrite(async () => {
      try {
        await regenerateOneDayAction(tripId, index);
        toast.success(`Day ${index + 1} rewritten`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't rewrite");
      }
    });
  }

  function moveUp() {
    if (index === 0) return;
    startMutation(async () => {
      await moveDayAction(tripId, index, index - 1);
      router.refresh();
    });
  }
  function moveDown() {
    if (index >= totalDays - 1) return;
    startMutation(async () => {
      await moveDayAction(tripId, index, index + 1);
      router.refresh();
    });
  }
  function deleteDay() {
    if (totalDays <= 1) {
      toast.error("Add another day first before deleting this one.");
      return;
    }
    if (!confirm(`Delete Day ${index + 1}? This cannot be undone.`)) return;
    startMutation(async () => {
      try {
        await removeDayAction(tripId, index);
        toast.success(`Day ${index + 1} deleted`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }
  function insertAfter() {
    startMutation(async () => {
      await insertDayAction(tripId, index + 1);
      toast.success(`New day inserted`);
      router.refresh();
    });
  }

  function suggestActivities() {
    startSuggest(async () => {
      try {
        const suggestions = await suggestActivitiesAction(tripId, index);
        const existing = new Set(day.activities ?? []);
        const merged = [
          ...(day.activities ?? []),
          ...suggestions.filter((s) => !existing.has(s)),
        ];
        patch("activities", merged);
        const added = merged.length - (day.activities?.length ?? 0);
        toast.success(
          added > 0 ? `Added ${added} activities` : "No new activities to add"
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't suggest");
      }
    });
  }

  function copyStayFromPrevious() {
    if (!previousDay) return;
    onChange({
      ...day,
      city: previousDay.city ?? day.city ?? null,
      hotel: previousDay.hotel ?? day.hotel ?? null,
      roomType: previousDay.roomType ?? day.roomType ?? null,
      mealPlan: previousDay.mealPlan ?? day.mealPlan ?? null,
      meals: previousDay.meals ?? day.meals ?? {},
    });
  }

  const canCopyStay =
    !!previousDay?.hotel &&
    (previousDay.hotel !== day.hotel || previousDay.city !== day.city);

  const dateLabel = startDate ? formatDayDate(startDate, index) : null;
  const meals = day.meals ?? {};

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="rounded-2xl border border-line bg-white shadow-soft overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-line bg-ivory/30">
        <span className="inline-flex items-center gap-2 rounded-full bg-navy text-ivory px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium">
          Day {index + 1}
        </span>
        {dateLabel && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {dateLabel}
          </span>
        )}
        <Input
          value={day.title}
          onChange={(e) => onChange({ ...day, title: e.target.value })}
          className="border-0 shadow-none bg-transparent font-display text-xl md:text-2xl text-navy h-auto px-0 focus-visible:ring-0 flex-1 min-w-0"
          placeholder={`Day ${index + 1} — title`}
        />
        <button
          type="button"
          onClick={rewriteDay}
          disabled={isRewriting || isMutating}
          className="h-8 px-3 rounded-xl text-xs text-sand-700 hover:text-navy hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
          title="Rewrite this day with AI"
        >
          {isRewriting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">Rewrite</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isMutating}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-navy hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center flex-shrink-0"
            aria-label="Day actions"
          >
            {isMutating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MoreHorizontal className="h-3.5 w-3.5" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={moveUp} disabled={index === 0}>
              <ArrowUp className="h-3.5 w-3.5" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={moveDown}
              disabled={index >= totalDays - 1}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={insertAfter}>
              <Plus className="h-3.5 w-3.5" />
              Insert day below
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={deleteDay}
              disabled={totalDays <= 1}
              className="text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete day
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="px-6 md:px-8 py-6 space-y-6">
        {/* Travel segments banner */}
        {segments.length > 0 && (
          <div className="space-y-2">
            {segments.map((s) => (
              <SegmentInlineCard key={s.id} segment={s} />
            ))}
          </div>
        )}

        {/* Location */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <SectionLabel icon={<MapPin className="h-3 w-3" />}>
            Location
          </SectionLabel>
          <Input
            value={day.city ?? ""}
            onChange={(e) => patch("city", e.target.value || null)}
            placeholder="e.g. Ubud, Bali"
            className="h-10"
          />
        </div>

        {/* Day overview */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <SectionLabel icon={<Layers className="h-3 w-3" />}>
            Day overview
          </SectionLabel>
          <Textarea
            rows={view === "normal" ? 3 : 4}
            value={day.summary ?? ""}
            onChange={(e) => patch("summary", e.target.value)}
            placeholder="A single paragraph telling the story of this day — what they'll experience, the mood, the highlights."
            className="text-sm leading-relaxed"
          />
        </div>

        {/* Activities */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start gap-1.5">
            <SectionLabel icon={<Map className="h-3 w-3" />}>
              Activities
            </SectionLabel>
            <button
              type="button"
              onClick={suggestActivities}
              disabled={isSuggesting}
              className="text-[10px] uppercase tracking-[0.18em] text-sand-700 hover:text-navy disabled:opacity-50 inline-flex items-center gap-1"
              title="AI suggestions for this city"
            >
              {isSuggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              Suggest
            </button>
          </div>
          <ChipInput
            value={day.activities ?? []}
            onChange={(v) => patch("activities", v)}
            placeholder="Type a place and press Enter — e.g. Sacred Monkey Forest"
          />
        </div>

        {/* Stay */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start gap-1.5">
            <SectionLabel icon={<Building2 className="h-3 w-3" />}>
              Stay
            </SectionLabel>
            {canCopyStay && (
              <button
                type="button"
                onClick={copyStayFromPrevious}
                className="text-[10px] uppercase tracking-[0.16em] text-sand-700 hover:text-navy inline-flex items-center gap-1"
                title="Copy hotel + meal plan from previous day"
              >
                <Copy className="h-3 w-3" />
                Same as previous
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              value={day.hotel ?? ""}
              onChange={(e) => patch("hotel", e.target.value || null)}
              placeholder="Hotel name"
              className="h-10"
            />
            <Input
              value={day.roomType ?? ""}
              onChange={(e) => patch("roomType", e.target.value || null)}
              placeholder="Room type"
              className="h-10"
            />
            <Input
              value={day.mealPlan ?? ""}
              onChange={(e) => patch("mealPlan", e.target.value || null)}
              placeholder="Meal plan (BB / HB / AP / AI)"
              className="h-10 sm:col-span-2"
            />
          </div>
        </div>

        {/* Meals */}
        <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
          <SectionLabel icon={<UtensilsCrossed className="h-3 w-3" />}>
            Meals included
          </SectionLabel>
          <MealToggles
            value={meals}
            onChange={(v) => patch("meals", v)}
          />
        </div>

        {/* ===== DETAILED ONLY ===== */}
        {view === "detailed" && (
          <>
            {/* Inclusions / Exclusions */}
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel icon={<ListChecks className="h-3 w-3" />}>
                Inclusions
              </SectionLabel>
              <ChipInput
                value={day.inclusions ?? []}
                onChange={(v) => patch("inclusions", v)}
                placeholder="Airport pickup, private guide, monument fees…"
              />
            </div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel
                icon={<ListChecks className="h-3 w-3" />}
                tone="muted"
              >
                Exclusions
              </SectionLabel>
              <ChipInput
                value={day.exclusions ?? []}
                onChange={(v) => patch("exclusions", v)}
                placeholder="Personal expenses, tips, alcohol…"
              />
            </div>

            {/* Transfer note */}
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel icon={<MapPin className="h-3 w-3" />}>
                Transfer note
              </SectionLabel>
              <Input
                value={day.transferNote ?? ""}
                onChange={(e) =>
                  patch("transferNote", e.target.value || null)
                }
                placeholder="Pickup at 9 AM, 4-hour drive via Coastal Highway"
                className="h-10"
              />
            </div>

            {/* Food note */}
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel icon={<UtensilsCrossed className="h-3 w-3" />}>
                Food highlight
              </SectionLabel>
              <Textarea
                rows={2}
                value={day.foodNote ?? ""}
                onChange={(e) =>
                  patch("foodNote", e.target.value || null)
                }
                placeholder="Specific food recommendation — e.g. Try babi guling at Ibu Oka in Ubud"
                className="text-sm"
              />
            </div>

            {/* Day image */}
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel icon={<ImageIcon className="h-3 w-3" />}>
                Day image
              </SectionLabel>
              <ImageUpload
                value={day.imageUrl}
                onChange={(url) => patch("imageUrl", url)}
                height="h-32"
                label="Upload day banner"
              />
            </div>

            {/* Internal notes */}
            <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
              <SectionLabel icon={<Sparkles className="h-3 w-3" />}>
                Internal notes
              </SectionLabel>
              <Textarea
                rows={2}
                value={day.notes ?? ""}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Logistics, distances, insider tips — visible to your team and on the proposal."
                className="text-sm"
              />
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function SectionLabel({
  icon,
  children,
  tone = "default",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] pt-2.5",
        tone === "muted" ? "text-muted-foreground" : "text-sand-700"
      )}
    >
      {icon}
      {children}
    </div>
  );
}

function MealToggles({
  value,
  onChange,
}: {
  value: DayMeals;
  onChange: (v: DayMeals) => void;
}) {
  const toggles: {
    key: keyof DayMeals;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "breakfast", label: "Breakfast", icon: <Coffee className="h-3 w-3" /> },
    { key: "lunch", label: "Lunch", icon: <Sun className="h-3 w-3" /> },
    { key: "dinner", label: "Dinner", icon: <Moon className="h-3 w-3" /> },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {toggles.map((t) => {
        const active = !!value[t.key];
        return (
          <button
            key={t.key}
            type="button"
            onClick={() =>
              onChange({ ...value, [t.key]: !active })
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
              active
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-line bg-white text-muted-foreground hover:border-sand-200"
            )}
            aria-pressed={active}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insert-between buttons
// ---------------------------------------------------------------------------

function InsertDayButton({
  tripId,
  position,
}: {
  tripId: string;
  position: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function insert() {
    startTransition(async () => {
      try {
        await insertDayAction(tripId, position);
        toast.success("Day inserted");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't insert");
      }
    });
  }

  return (
    <div className="flex justify-center -my-2 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={insert}
        disabled={isPending}
        className="h-7 px-3 rounded-full bg-white border border-dashed border-sand-300 text-[10px] uppercase tracking-[0.18em] text-sand-700 hover:bg-sand-50 hover:border-sand inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
        Insert day
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty + skeleton states
// ---------------------------------------------------------------------------

function EmptyItinerary({
  destination,
  onGenerate,
  isGenerating,
}: {
  destination: string;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white/60 p-12 md:p-16 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
        Itinerary
      </p>
      <h2 className="mt-3 font-display text-3xl text-navy">{destination}</h2>
      <p className="mt-3 max-w-md mx-auto text-sm text-muted-foreground">
        We haven't generated this itinerary yet. Click below to draft a
        day-by-day plan you can shape.
      </p>
      <div className="mt-8">
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate itinerary
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function ItinerarySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-1/3" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-line bg-white p-6 md:p-8 space-y-4"
        >
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDayDate(startDate: Date, dayIndex: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
