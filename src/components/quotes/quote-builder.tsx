"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { QuoteStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computePricing,
  type LineItemCategory,
  type PricingItem,
} from "@/types";
import { ShareDialog } from "@/components/quotes/share-dialog";
import { SuccessFlash } from "@/components/ui/success-flash";
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

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const NEW_ID = "__new__";

export type QuoteData = {
  id: string;
  version: number;
  status: QuoteStatus;
  markupPct: number;
  discountPct: number;
  shareToken: string | null;
  items: PricingItem[];
};

type DraftState = {
  items: PricingItem[];
  markupPct: number;
  discountPct: number;
};

function defaultDraft(): DraftState {
  return {
    items: [
      { id: uid(), category: "Hotel", label: "Hotel stay", cost: 0 },
      { id: uid(), category: "Transport", label: "Transfers", cost: 0 },
    ],
    markupPct: 15,
    discountPct: 0,
  };
}

export function QuoteBuilder({
  tripId,
  quotes,
}: {
  tripId: string;
  quotes: QuoteData[];
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
        }
      : defaultDraft()
  );

  // Reload draft when active tab changes (or server data refreshes)
  useEffect(() => {
    if (isNew) {
      setDraft(defaultDraft());
    } else if (activeQuote) {
      setDraft({
        items: activeQuote.items,
        markupPct: activeQuote.markupPct,
        discountPct: activeQuote.discountPct,
      });
    }
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

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isMutating, startMutation] = useTransition();
  const [flash, setFlash] = useState<{
    title: string;
    body?: string;
  } | null>(null);

  const editable = isNew || activeQuote?.status === "DRAFT";

  function patch(partial: Partial<DraftState>) {
    if (!editable) return;
    setDraft((d) => ({ ...d, ...partial }));
  }

  function addItem(category: LineItemCategory = "Other") {
    if (!editable) return;
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        { id: uid(), category, label: "", cost: 0 },
      ],
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

  function save() {
    startSave(async () => {
      try {
        const r = await saveQuoteAction({
          tripId,
          quoteId: isNew ? null : activeQuote!.id,
          items: draft.items,
          markupPct: draft.markupPct,
          discountPct: draft.discountPct,
        });
        setSavedAt(new Date().toLocaleTimeString());
        toast.success(isNew ? "Quote created" : "Quote saved");
        if (isNew) setActiveId(r.quoteId);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save quote");
      }
    });
  }

  function addVersion() {
    if (!activeQuote) {
      // First quote — just save the new draft
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

  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft p-6 md:p-8">
      <SuccessFlash
        open={flash !== null}
        onClose={() => setFlash(null)}
        title={flash?.title ?? ""}
        body={flash?.body}
      />
      <header className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-600">
            Quotation
          </p>
          <h2 className="font-display text-2xl text-navy">
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

      {quotes.length > 0 && (
        <div className="flex items-center gap-1 mb-6 flex-wrap border-b border-line pb-3">
          {quotes.map((q) => (
            <button
              key={q.id}
              onClick={() => setActiveId(q.id)}
              className={cn(
                "h-8 px-3 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5",
                q.id === activeId
                  ? "bg-navy text-ivory"
                  : "text-muted-foreground hover:text-navy hover:bg-ivory"
              )}
            >
              v{q.version}
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  q.status === "ACCEPTED"
                    ? "bg-emerald-500"
                    : q.status === "SENT"
                      ? "bg-sand-500"
                      : q.status === "REJECTED"
                        ? "bg-red-400"
                        : q.id === activeId
                          ? "bg-ivory/60"
                          : "bg-line"
                )}
              />
            </button>
          ))}
          <button
            onClick={addVersion}
            disabled={isMutating}
            className="h-8 w-8 rounded-xl border border-dashed border-line text-muted-foreground hover:text-navy hover:border-sand transition-colors flex items-center justify-center disabled:opacity-50"
            title="New version"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {draft.items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-[140px_1fr_140px_40px] gap-2 items-center"
            >
              <Select
                value={item.category}
                onValueChange={(v) =>
                  updateItem(item.id, { category: v as LineItemCategory })
                }
                disabled={!editable}
              >
                <SelectTrigger className="h-10">
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
                placeholder="Description"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                disabled={!editable}
                className="h-10"
              />
              <Input
                type="number"
                min={0}
                placeholder="Cost (₹)"
                value={item.cost || ""}
                onChange={(e) =>
                  updateItem(item.id, { cost: Number(e.target.value || 0) })
                }
                disabled={!editable}
                className="h-10 text-right"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={!editable}
                className="h-10 w-10 rounded-2xl border border-line text-muted-foreground hover:text-red-600 hover:border-red-200 transition-colors flex items-center justify-center disabled:opacity-30"
                aria-label="Remove line item"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addItem()}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add line item
          </Button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
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
          <Label htmlFor="discount">Discount %</Label>
          <Input
            id="discount"
            type="number"
            min={0}
            max={100}
            value={draft.discountPct}
            onChange={(e) =>
              patch({ discountPct: Number(e.target.value || 0) })
            }
            disabled={!editable}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-navy text-ivory px-6 py-5">
        <Row label="Subtotal" value={formatINR(summary.totalCost)} />
        <Row
          label={`Markup (${draft.markupPct}%)`}
          value={`+${formatINR(summary.markupAmount)}`}
          muted
        />
        {summary.discountAmount > 0 && (
          <Row
            label={`Discount (${draft.discountPct}%)`}
            value={`−${formatINR(summary.discountAmount)}`}
            muted
          />
        )}
        <div className="my-3 h-px bg-ivory/15" />
        <Row
          label="Selling price"
          value={formatINR(summary.sellingPrice)}
          emphasis
        />
        <Row label="Profit" value={formatINR(summary.profit)} muted />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {savedAt ? `Saved ${savedAt}` : "—"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeQuote && (
            <ShareDialog
              quoteId={activeQuote.id}
              existingToken={activeQuote.shareToken}
              trigger={
                <Button variant="outline" size="sm">
                  <Link2 className="h-3.5 w-3.5" />
                  Share
                </Button>
              }
            />
          )}

          {editable && (
            <Button
              size="sm"
              onClick={save}
              disabled={isSaving || draft.items.length === 0}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          )}

          {activeQuote?.status === "DRAFT" && (
            <Button size="sm" variant="accent" onClick={markSent} disabled={isMutating}>
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
          muted ? "text-ivory/50" : "text-ivory/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          emphasis
            ? "font-display text-sand text-2xl"
            : "font-medium text-ivory"
        )}
      >
        {value}
      </span>
    </div>
  );
}
