"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  Info,
  Link2,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { QuoteStatus, TravelSegment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  computePricing,
  type LineItemCategory,
  type PricingItem,
} from "@/types";
import type { ItineraryContent } from "@/lib/ai";
import { ShareDialog } from "@/components/quotes/share-dialog";
import { SuccessFlash } from "@/components/ui/success-flash";
import { SendProposalDialog } from "@/components/quotes/send-proposal-dialog";
import {
  acceptQuoteAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  markQuoteSentAction,
  rejectQuoteAction,
  revertQuoteToDraftAction,
  saveQuoteAction,
} from "@/server/actions/quotes";
import { cn, formatINR } from "@/lib/utils";

const CATEGORIES: LineItemCategory[] = [
  "Hotel",
  "Transport",
  "Activities",
  "Flights",
  "Other",
];

const CATEGORY_LABEL: Record<LineItemCategory, string> = {
  Hotel: "Accommodation",
  Transport: "Transfers & transport",
  Activities: "Experiences",
  Flights: "Flights",
  Other: "Other",
};

const STATUS_TONE: Record<
  QuoteStatus,
  "outline" | "accent" | "default" | "success" | "danger" | "muted"
> = {
  DRAFT: "outline",
  SENT: "accent",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "muted",
};

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

// Pre-built shortcuts the agent reaches for on every trip.
const COMMON_ITEMS: { label: string; category: LineItemCategory }[] = [
  { label: "Travel insurance", category: "Other" },
  { label: "Visa fees", category: "Other" },
  { label: "Tips / gratuities", category: "Other" },
  { label: "Airport transfer", category: "Transport" },
  { label: "SIM card / data plan", category: "Other" },
  { label: "Tour guide", category: "Activities" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const NEW_ID = "__new__";
const AUTOSAVE_DELAY_MS = 1500;

export type QuoteData = {
  id: string;
  version: number;
  status: QuoteStatus;
  markupPct: number;
  discountPct: number;
  sellingPrice: number;
  shareToken: string | null;
  internalNotes: string | null;
  items: PricingItem[];
};

type DraftState = {
  items: PricingItem[];
  markupPct: number;
  discountPct: number;
  internalNotes: string;
};

type DiscountMode = "PCT" | "AMOUNT";
type SaveStatus = "idle" | "saving" | "saved" | "error";

function defaultDraft(): DraftState {
  return {
    items: [
      { id: uid(), category: "Hotel", label: "Hotel stay", cost: 0 },
      { id: uid(), category: "Transport", label: "Transfers", cost: 0 },
    ],
    markupPct: 15,
    discountPct: 0,
    internalNotes: "",
  };
}

/** Stable signature of a draft — used to detect unsaved changes. */
function signatureOf(d: DraftState): string {
  return JSON.stringify({
    items: d.items.map((i) => ({
      category: i.category,
      label: i.label.trim(),
      cost: i.cost,
    })),
    markupPct: d.markupPct,
    discountPct: d.discountPct,
    internalNotes: d.internalNotes.trim(),
  });
}

export function QuoteBuilder({
  tripId,
  travelers,
  quotes,
  itinerary,
  segments,
  destination,
  recipient,
  agencyName,
}: {
  tripId: string;
  travelers: number;
  quotes: QuoteData[];
  itinerary: ItineraryContent | null;
  segments: TravelSegment[];
  /** Optional context for the send-proposal composer. */
  destination?: string;
  recipient?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  agencyName?: string;
}) {
  const router = useRouter();

  const initialActive = quotes[quotes.length - 1]?.id ?? NEW_ID;
  const [activeId, setActiveId] = useState<string>(initialActive);
  const isNew = activeId === NEW_ID;
  const activeQuote = quotes.find((q) => q.id === activeId) ?? null;

  const [draft, setDraft] = useState<DraftState>(() =>
    activeQuote
      ? {
          items: activeQuote.items,
          markupPct: activeQuote.markupPct,
          discountPct: activeQuote.discountPct,
          internalNotes: activeQuote.internalNotes ?? "",
        }
      : defaultDraft()
  );

  // Last known-saved signature for the active quote. Compared against the
  // current draft to drive autosave + "Unsaved changes" indicator.
  const savedSignatureRef = useRef<string>(signatureOf(draft));

  // Reload draft when the active tab changes (or server data refreshes).
  useEffect(() => {
    const next: DraftState = isNew
      ? defaultDraft()
      : activeQuote
        ? {
            items: activeQuote.items,
            markupPct: activeQuote.markupPct,
            discountPct: activeQuote.discountPct,
            internalNotes: activeQuote.internalNotes ?? "",
          }
        : defaultDraft();
    setDraft(next);
    savedSignatureRef.current = signatureOf(next);
    setSaveStatus("idle");
  }, [activeId, isNew, activeQuote]);

  // Sync activeId with server quotes — handles first-save (NEW_ID -> v1)
  // and stale activeId (e.g. deleted quote) by snapping to the latest.
  useEffect(() => {
    if (quotes.length === 0) return;
    const stillExists = quotes.some((q) => q.id === activeId);
    if (!stillExists) {
      setActiveId(quotes[quotes.length - 1].id);
    }
  }, [quotes, activeId]);

  const summary = useMemo(
    () =>
      computePricing({
        items: draft.items,
        markupPct: draft.markupPct,
        discountPct: draft.discountPct,
      }),
    [draft]
  );

  const marginPct =
    summary.sellingPrice > 0 ? (summary.profit / summary.sellingPrice) * 100 : 0;
  const perPersonSelling =
    travelers > 0 ? Math.round(summary.sellingPrice / travelers) : 0;

  const [discountMode, setDiscountMode] = useState<DiscountMode>("PCT");
  const [perPerson, setPerPerson] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<LineItemCategory>>(() => new Set());

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [agoTick, setAgoTick] = useState(0);
  const [isSaving, startSave] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [flash, setFlash] = useState<{ title: string; body?: string } | null>(
    null
  );

  const editable = isNew || activeQuote?.status === "DRAFT";
  const currentSignature = useMemo(() => signatureOf(draft), [draft]);
  const isDirty = currentSignature !== savedSignatureRef.current;

  function patch(partial: Partial<DraftState>) {
    if (!editable) return;
    setDraft((d) => ({ ...d, ...partial }));
  }

  function addItem(category: LineItemCategory = "Other", label = "") {
    if (!editable) return;
    setDraft((d) => ({
      ...d,
      items: [...d.items, { id: uid(), category, label, cost: 0 }],
    }));
  }
  function removeItem(id: string) {
    if (!editable) return;
    setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
  }
  function updateItem(id: string, p: Partial<PricingItem>) {
    if (!editable) return;
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? { ...i, ...p } : i)),
    }));
  }

  // --- save (manual + autosave) ----------------------------------------

  const runSave = useCallback(
    async (silent: boolean) => {
      setSaveStatus("saving");
      try {
        const r = await saveQuoteAction({
          tripId,
          quoteId: isNew ? null : activeQuote!.id,
          items: draft.items,
          markupPct: draft.markupPct,
          discountPct: draft.discountPct,
          internalNotes: draft.internalNotes,
        });
        savedSignatureRef.current = currentSignature;
        setLastSavedAt(new Date());
        setSaveStatus("saved");
        if (!silent) toast.success(isNew ? "Quote created" : "Quote saved");
        if (isNew) setActiveId(r.quoteId);
        router.refresh();
      } catch (e) {
        setSaveStatus("error");
        toast.error(e instanceof Error ? e.message : "Couldn't save quote");
      }
    },
    [tripId, isNew, activeQuote, draft, currentSignature, router]
  );

  function save() {
    startSave(() => runSave(false));
  }

  // Autosave: only for existing DRAFT quotes (a brand-new tab waits for an
  // explicit Save to materialize). Debounced so rapid edits don't fire a
  // request per keystroke.
  useEffect(() => {
    if (!editable || isNew || !activeQuote) return;
    if (!isDirty) return;
    const t = setTimeout(() => {
      runSave(true);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [editable, isNew, activeQuote, isDirty, runSave]);

  // Tick once a minute so "Saved 12s ago" stays fresh.
  useEffect(() => {
    if (!lastSavedAt) return;
    const t = setInterval(() => setAgoTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [lastSavedAt]);
  void agoTick;

  // --- version actions --------------------------------------------------

  function addVersion() {
    if (!activeQuote) {
      save();
      return;
    }
    startMutation(async () => {
      try {
        const r = await duplicateQuoteAction(activeQuote.id);
        toast.success(`Started v${r.version}`);
        setActiveId(r.quoteId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't duplicate");
      }
    });
  }

  function markSent() {
    if (!activeQuote) return;
    startMutation(async () => {
      try {
        await markQuoteSentAction(activeQuote.id);
        toast.success("Marked as sent");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't mark sent");
      }
    });
  }

  function accept() {
    if (!activeQuote) return;
    startMutation(async () => {
      try {
        await acceptQuoteAction(activeQuote.id);
        setFlash({
          title: "Booking confirmed ✨",
          body: `Quote v${activeQuote.version} accepted — they're going.`,
        });
        toast.success("Quote accepted — booking created");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't accept quote");
      }
    });
  }

  function reject() {
    if (!activeQuote) return;
    startMutation(async () => {
      try {
        await rejectQuoteAction(activeQuote.id);
        toast.success("Quote rejected");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't reject quote");
      }
    });
  }

  function revertToDraft() {
    if (!activeQuote) return;
    if (activeQuote.status === "ACCEPTED") {
      if (
        !confirm(
          "This will delete the booking and walk the trip back to QUOTED. Continue?"
        )
      ) {
        return;
      }
    }
    startMutation(async () => {
      try {
        await revertQuoteToDraftAction(activeQuote.id);
        toast.success(`Quote v${activeQuote.version} back to draft`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't revert");
      }
    });
  }

  function deleteQuote() {
    if (!activeQuote) return;
    if (!confirm(`Delete quote v${activeQuote.version}? This cannot be undone.`)) {
      return;
    }
    startMutation(async () => {
      try {
        await deleteQuoteAction(activeQuote.id);
        toast.success("Quote deleted");
        const remaining = quotes.filter((q) => q.id !== activeQuote.id);
        setActiveId(remaining[remaining.length - 1]?.id ?? NEW_ID);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  // --- pull from itinerary ---------------------------------------------

  const pullable = useMemo(
    () => buildPullSuggestions(itinerary, segments),
    [itinerary, segments]
  );

  function pullFromItinerary() {
    if (!editable) return;
    if (pullable.length === 0) return;
    setDraft((d) => {
      const existingLabels = new Set(
        d.items.map((i) => i.label.trim().toLowerCase())
      );
      const additions = pullable
        .filter((p) => !existingLabels.has(p.label.trim().toLowerCase()))
        .map((p) => ({
          id: uid(),
          category: p.category,
          label: p.label,
          cost: 0,
        }));
      if (additions.length === 0) {
        toast.info("All itinerary items are already on the quote.");
        return d;
      }
      toast.success(
        `Added ${additions.length} item${additions.length === 1 ? "" : "s"} from itinerary`
      );
      return { ...d, items: [...d.items, ...additions] };
    });
  }

  // --- group + collapse logic -------------------------------------------

  const groups = useMemo(() => {
    const byCat = new Map<LineItemCategory, PricingItem[]>();
    for (const item of draft.items) {
      const list = byCat.get(item.category) ?? [];
      list.push(item);
      byCat.set(item.category, list);
    }
    return CATEGORIES.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
      subtotal: byCat.get(c)!.reduce((s, i) => s + (i.cost || 0), 0),
    }));
  }, [draft.items]);

  function toggleGroup(c: LineItemCategory) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  // --- discount mode ----------------------------------------------------

  const discountAmount = (summary.totalCost * draft.markupPct) / 100 + summary.totalCost;
  // Easier: discount is taken AFTER markup applied to totalCost. Use the
  // computePricing values directly to avoid drift.
  const subtotalWithMarkup = summary.totalCost + summary.markupAmount;
  const discountAsAmount = Math.round(
    (subtotalWithMarkup * draft.discountPct) / 100
  );
  void discountAmount;

  function setDiscountFromAmount(amount: number) {
    if (subtotalWithMarkup <= 0) {
      patch({ discountPct: 0 });
      return;
    }
    const pct = Math.max(0, Math.min(100, (amount / subtotalWithMarkup) * 100));
    patch({ discountPct: Math.round(pct * 100) / 100 });
  }

  // --- version diff -----------------------------------------------------

  const baseSellingPrice = quotes[0]?.sellingPrice ?? null;

  return (
    <section
      className={cn(
        "flex flex-col rounded-lg border border-line bg-paper shadow-soft",
        "lg:max-h-[calc(100vh-7rem)]"
      )}
    >
      <SuccessFlash
        open={flash !== null}
        onClose={() => setFlash(null)}
        title={flash?.title ?? ""}
        body={flash?.body}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-5 md:p-6">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="tc-eyebrow">Quotation</p>
          <h2 className="font-display text-2xl text-ink">
            {activeQuote
              ? `Version ${activeQuote.version}`
              : isNew
                ? "New quote"
                : "Loading…"}
          </h2>
        </div>
        {activeQuote && (
          <Badge variant={STATUS_TONE[activeQuote.status]}>
            {STATUS_LABEL[activeQuote.status]}
          </Badge>
        )}
      </header>

      {/* Version tabs with delta chip */}
      {quotes.length > 0 && (
        <div className="flex items-center gap-1 mb-6 flex-wrap border-b border-line pb-3">
          {quotes.map((q) => {
            const isActive = q.id === activeId;
            const delta =
              baseSellingPrice !== null && q.version > 1
                ? q.sellingPrice - baseSellingPrice
                : null;
            return (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className={cn(
                  "h-8 px-3 rounded-[8px] text-xs font-medium transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-inkwash text-[var(--on-dark)]"
                    : "text-muted hover:text-ink hover:bg-paper-2"
                )}
              >
                v{q.version}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    q.status === "ACCEPTED"
                      ? "bg-ok"
                      : q.status === "SENT"
                        ? "bg-gold-deep"
                        : q.status === "REJECTED"
                          ? "bg-bad"
                          : isActive
                            ? "bg-[var(--on-dark)]/60"
                            : "bg-line"
                  )}
                />
                {delta !== null && delta !== 0 && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums font-mono",
                      isActive
                        ? "text-[var(--on-dark)]/80"
                        : delta > 0
                          ? "text-ok"
                          : "text-bad"
                    )}
                  >
                    {delta > 0 ? "+" : "−"}
                    {formatINR(Math.abs(delta))}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={addVersion}
            disabled={isMutating}
            className="h-8 w-8 rounded-[8px] border border-dashed border-line text-muted hover:text-ink hover:border-[var(--gold-line)] transition-colors flex items-center justify-center disabled:opacity-50"
            title="New version"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pull-from-itinerary banner — appears when the trip has content the
          agent hasn't pulled into this quote yet. */}
      {editable && pullable.length > 0 && draft.items.every((i) => !i.label) && (
        <div className="mb-4 rounded-[10px] border border-[var(--gold-line)] bg-gold-soft p-3.5 flex items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-paper text-gold-deep">
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">
              Pull {pullable.length} item
              {pullable.length === 1 ? "" : "s"} from the itinerary
            </p>
            <p className="text-xs text-muted mt-0.5">
              Hotels, activities, and flights already on the trip. Costs stay
              blank for you to fill in.
            </p>
          </div>
          <Button
            size="sm"
            variant="accent"
            onClick={pullFromItinerary}
            disabled={!editable}
          >
            <Download className="h-3.5 w-3.5" />
            Pull
          </Button>
        </div>
      )}

      {/* Line items, grouped by category with subtotals */}
      <div className="space-y-4">
        {groups.length === 0 && editable && (
          <p className="text-sm text-muted italic">
            No line items yet — add one below or pull from the itinerary.
          </p>
        )}
        <AnimatePresence initial={false}>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.category);
            return (
              <motion.div
                key={g.category}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-line bg-paper-2 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.category)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-paper-2 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted" />
                    )}
                    <span className="text-[11px] uppercase tracking-[0.22em] text-gold-deep">
                      {CATEGORY_LABEL[g.category]}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
                      {g.items.length}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-ink tabular-nums font-mono">
                    {formatINR(g.subtotal)}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="px-3 pb-3 space-y-2">
                    {g.items.map((item) => (
                      <LineItem
                        key={item.id}
                        item={item}
                        editable={editable}
                        onChange={updateItem}
                        onRemove={removeItem}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {editable && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addItem()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add line item
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Common items
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Add a common item</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COMMON_ITEMS.map((c) => (
                  <DropdownMenuItem
                    key={c.label}
                    onClick={() => addItem(c.category, c.label)}
                    className="flex items-center justify-between"
                  >
                    <span>{c.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
                      {c.category}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {pullable.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={pullFromItinerary}
                title="Pull hotels, activities, and segments from the trip itinerary"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Pull from itinerary
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Markup + discount, with the discount input switchable %/₹ */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="markup">Markup %</Label>
          <Input
            id="markup"
            type="number"
            min={0}
            max={500}
            value={draft.markupPct}
            onChange={(e) =>
              patch({ markupPct: Number(e.target.value || 0) })
            }
            disabled={!editable}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="discount">
              Discount {discountMode === "PCT" ? "%" : "₹"}
            </Label>
            <div className="flex rounded-[6px] border border-line bg-paper p-0.5">
              <button
                type="button"
                onClick={() => setDiscountMode("PCT")}
                className={cn(
                  "px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-[4px] transition-colors",
                  discountMode === "PCT"
                    ? "bg-inkwash text-[var(--on-dark)]"
                    : "text-muted hover:text-ink"
                )}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setDiscountMode("AMOUNT")}
                className={cn(
                  "px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-[4px] transition-colors",
                  discountMode === "AMOUNT"
                    ? "bg-inkwash text-[var(--on-dark)]"
                    : "text-muted hover:text-ink"
                )}
              >
                ₹
              </button>
            </div>
          </div>
          {discountMode === "PCT" ? (
            <Input
              id="discount"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={draft.discountPct}
              onChange={(e) =>
                patch({ discountPct: Number(e.target.value || 0) })
              }
              disabled={!editable}
            />
          ) : (
            <Input
              id="discount"
              type="number"
              min={0}
              value={discountAsAmount || ""}
              onChange={(e) =>
                setDiscountFromAmount(Number(e.target.value || 0))
              }
              disabled={!editable}
              placeholder="0"
            />
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 rounded-lg bg-inkwash text-[var(--on-dark)] px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--on-dark)]/60">
            Pricing summary
          </span>
          <div className="flex rounded-[6px] border border-[var(--on-dark)]/15 p-0.5">
            <button
              type="button"
              onClick={() => setPerPerson(false)}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-[4px] transition-colors",
                !perPerson
                  ? "bg-paper text-ink"
                  : "text-[var(--on-dark)]/60 hover:text-[var(--on-dark)]"
              )}
            >
              Total
            </button>
            <button
              type="button"
              onClick={() => setPerPerson(true)}
              disabled={travelers <= 1}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] rounded-[4px] transition-colors disabled:opacity-30",
                perPerson
                  ? "bg-paper text-ink"
                  : "text-[var(--on-dark)]/60 hover:text-[var(--on-dark)]"
              )}
            >
              Per person
            </button>
          </div>
        </div>
        <Row label="Subtotal" value={formatINR(summary.totalCost)} muted />
        <Row
          label={`Markup (${draft.markupPct}%)`}
          value={`+${formatINR(summary.markupAmount)}`}
          muted
        />
        {summary.discountAmount > 0 && (
          <Row
            label={`Discount (${draft.discountPct.toFixed(1)}%)`}
            value={`−${formatINR(summary.discountAmount)}`}
            muted
          />
        )}
        <div className="my-3 h-px bg-[var(--on-dark)]/15" />
        <Row
          label={perPerson ? "Selling — per person" : "Selling price"}
          value={formatINR(perPerson ? perPersonSelling : summary.sellingPrice)}
          emphasis
        />
        {!perPerson && travelers > 1 && (
          <p className="text-[11px] text-[var(--on-dark)]/55 -mt-1 font-mono tabular-nums">
            {formatINR(perPersonSelling)} × {travelers} travellers
          </p>
        )}
        <Row
          label="Profit"
          value={`${formatINR(summary.profit)}  ·  ${marginPct.toFixed(1)}%`}
          muted
        />
      </div>

      {/* Internal notes (operator-only) */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Info className="h-3 w-3 text-muted" />
          <Label htmlFor="internal-notes" className="text-[11px] uppercase tracking-[0.18em] text-muted">
            Internal notes (operator-only)
          </Label>
        </div>
        <Textarea
          id="internal-notes"
          rows={2}
          value={draft.internalNotes}
          onChange={(e) => patch({ internalNotes: e.target.value })}
          disabled={!editable}
          placeholder="Margin floor, supplier reminders, haggle limits — never reaches the customer."
          className="text-sm"
        />
      </div>

      {activeQuote && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted mb-3">
            Delivery status
          </p>
          <DeliveryTimeline status={activeQuote.status} />
        </div>
      )}

      </div>

      {/* Sticky footer — Save / Send / Accept stay visible regardless of
          how much content the panel holds. */}
      <div className="border-t border-line bg-paper px-4 py-3 md:px-5 md:py-3 rounded-b-lg flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.08)]">
        <SaveIndicator
          status={saveStatus}
          isDirty={isDirty}
          lastSavedAt={lastSavedAt}
          editable={!!editable}
        />
        <div className="flex flex-wrap items-center gap-2">
          {activeQuote && (
            <ShareDialog
              quoteId={activeQuote.id}
              existingToken={activeQuote.shareToken}
              trigger={
                <Button variant="outline" size="sm">
                  <Link2 className="h-3.5 w-3.5" />
                  Share link
                </Button>
              }
            />
          )}

          {/* The dominant action — open the focused send composer (WhatsApp /
              Email / Link) with a live preview. */}
          {activeQuote &&
            (activeQuote.status === "DRAFT" || activeQuote.status === "SENT") && (
              <SendProposalDialog
                tripId={tripId}
                quoteId={activeQuote.id}
                destination={destination}
                recipientName={recipient?.name ?? null}
                recipientPhone={recipient?.phone ?? null}
                recipientEmail={recipient?.email ?? null}
                agencyName={agencyName}
                total={summary.sellingPrice}
                perPerson={perPersonSelling}
                version={activeQuote.version}
                shareToken={activeQuote.shareToken}
                trigger={
                  <Button
                    size="sm"
                    variant={activeQuote.status === "SENT" ? "default" : "accent"}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {activeQuote.status === "SENT" ? "Resend" : "Send proposal"}
                  </Button>
                }
              />
            )}

          {editable && (
            <Button
              size="sm"
              variant={isDirty ? "default" : "outline"}
              onClick={save}
              disabled={isSaving || draft.items.length === 0}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          )}

          {activeQuote?.status === "DRAFT" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={markSent}
              disabled={isMutating}
              title="Mark this quote as sent without sending via WhatsApp"
            >
              <Send className="h-3.5 w-3.5" />
              Mark sent
            </Button>
          )}

          {(activeQuote?.status === "DRAFT" ||
            activeQuote?.status === "SENT") && (
            <Button
              size="sm"
              variant="default"
              onClick={accept}
              disabled={isMutating}
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          )}

          {activeQuote?.status === "SENT" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={reject}
              disabled={isMutating}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          )}

          {activeQuote &&
            activeQuote.status !== "DRAFT" &&
            activeQuote.status !== "EXPIRED" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={revertToDraft}
                disabled={isMutating}
                title="Revert to draft"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Revert
              </Button>
            )}

          {activeQuote && activeQuote.status !== "ACCEPTED" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={deleteQuote}
              disabled={isMutating}
              title="Delete quote"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

// --- delivery timeline ---------------------------------------------------

function DeliveryTimeline({ status }: { status: QuoteStatus }) {
  const steps = ["Drafted", "Sent", "Viewed", "Accepted"] as const;
  // done = count of completed steps; current = the step with the gold ring.
  const { done, current } =
    status === "ACCEPTED"
      ? { done: 4, current: -1 }
      : status === "SENT"
        ? { done: 2, current: 2 }
        : status === "REJECTED" || status === "EXPIRED"
          ? { done: 2, current: -1 }
          : { done: 1, current: 1 }; // DRAFT

  return (
    <div className="flex items-start">
      {steps.map((label, i) => {
        const isDone = i < done;
        const isCurrent = i === current;
        return (
          <div
            key={label}
            className="relative flex flex-1 flex-col items-center"
          >
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "absolute top-[6px] left-1/2 h-0.5 w-full",
                  i < done - 1 || (isDone && i < done) ? "bg-ok" : "bg-line"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 h-[13px] w-[13px] rounded-full border-2",
                isDone
                  ? "bg-ok border-ok"
                  : isCurrent
                    ? "bg-gold border-gold ring-4 ring-[var(--gold-line)]"
                    : "bg-paper border-line"
              )}
            />
            <span
              className={cn(
                "mt-2 text-[9.5px] font-semibold uppercase tracking-[0.12em]",
                isCurrent
                  ? "text-gold-deep"
                  : isDone
                    ? "text-ink-2"
                    : "text-muted"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --- line item -----------------------------------------------------------

function LineItem({
  item,
  editable,
  onChange,
  onRemove,
}: {
  item: PricingItem;
  editable: boolean | undefined;
  onChange: (id: string, p: Partial<PricingItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-[10px] border border-line bg-paper p-2.5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Select
          value={item.category}
          onValueChange={(v) =>
            onChange(item.id, { category: v as LineItemCategory })
          }
          disabled={!editable}
        >
          <SelectTrigger className="h-9 w-[130px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          placeholder="Cost (₹)"
          value={item.cost || ""}
          onChange={(e) =>
            onChange(item.id, { cost: Number(e.target.value || 0) })
          }
          disabled={!editable}
          className="h-9 flex-1 min-w-0 text-right tabular-nums"
        />
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={!editable}
          className="h-9 w-9 shrink-0 rounded-[8px] border border-line text-muted hover:text-bad hover:border-bad-soft transition-colors flex items-center justify-center disabled:opacity-30"
          aria-label="Remove line item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        placeholder="Description — e.g. Taj Mahal Palace · Sea-view deluxe"
        value={item.label}
        onChange={(e) => onChange(item.id, { label: e.target.value })}
        disabled={!editable}
        className="h-9 w-full text-sm"
      />
    </motion.div>
  );
}

// --- save indicator ------------------------------------------------------

function SaveIndicator({
  status,
  isDirty,
  lastSavedAt,
  editable,
}: {
  status: SaveStatus;
  isDirty: boolean;
  lastSavedAt: Date | null;
  editable: boolean;
}) {
  if (!editable) {
    return (
      <span className="text-xs text-muted inline-flex items-center gap-1.5">
        <Cloud className="h-3 w-3" />
        Read-only
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="text-xs text-muted inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="text-xs text-bad inline-flex items-center gap-1.5">
        <CloudOff className="h-3 w-3" />
        Save failed — retry
      </span>
    );
  }
  if (isDirty) {
    return (
      <span className="text-xs text-warn inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-warn" />
        Unsaved changes
      </span>
    );
  }
  if (lastSavedAt) {
    return (
      <span className="text-xs text-muted inline-flex items-center gap-1.5">
        <Check className="h-3 w-3 text-ok" />
        Saved {timeAgo(lastSavedAt)}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted inline-flex items-center gap-1.5">
      <Cloud className="h-3 w-3" />
      Idle
    </span>
  );
}

function timeAgo(d: Date): string {
  const sec = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

// --- pull-from-itinerary suggestions -------------------------------------

type PullSuggestion = { category: LineItemCategory; label: string };

function buildPullSuggestions(
  itinerary: ItineraryContent | null,
  segments: TravelSegment[]
): PullSuggestion[] {
  const out: PullSuggestion[] = [];
  const seen = new Set<string>();
  const push = (s: PullSuggestion) => {
    const k = s.label.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };

  // Travel segments — flights and trains become Flights / Transport lines.
  for (const seg of segments) {
    const route = `${seg.from} → ${seg.to}`;
    if (seg.type === "FLIGHT") {
      const id =
        [seg.airline, seg.flightNumber].filter(Boolean).join(" ") || null;
      push({
        category: "Flights",
        label: `Flight: ${route}${id ? ` (${id})` : ""}`,
      });
    } else {
      const id =
        [seg.trainName, seg.trainNumber].filter(Boolean).join(" ") || null;
      push({
        category: "Transport",
        label: `Train: ${route}${id ? ` (${id})` : ""}`,
      });
    }
  }

  if (itinerary) {
    for (let i = 0; i < itinerary.days.length; i++) {
      const day = itinerary.days[i];
      if (day.hotel?.trim()) {
        const room = day.roomType?.trim() ? ` · ${day.roomType.trim()}` : "";
        push({
          category: "Hotel",
          label: `Day ${i + 1}: ${day.hotel.trim()}${room}`,
        });
      }
      if (day.transferNote?.trim()) {
        push({
          category: "Transport",
          label: `Day ${i + 1} transfer: ${day.transferNote.trim()}`,
        });
      }
      for (const act of day.activities ?? []) {
        const t = act.trim();
        if (!t) continue;
        push({ category: "Activities", label: `Day ${i + 1}: ${t}` });
      }
    }
  }

  return out;
}

// --- summary row --------------------------------------------------------

function Row({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span
        className={cn(
          "text-xs uppercase tracking-[0.18em]",
          muted ? "text-[var(--on-dark)]/50" : "text-[var(--on-dark)]/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          emphasis
            ? "font-display text-gold-deep text-2xl font-semibold tabular-nums font-mono"
            : "font-medium text-[var(--on-dark)] tabular-nums font-mono"
        )}
      >
        {value}
      </span>
    </div>
  );
}
