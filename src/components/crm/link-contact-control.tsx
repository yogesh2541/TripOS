"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Pencil, Search, Unlink, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  linkTripToLeadAction,
  unlinkTripFromLeadAction,
} from "@/server/actions/trips";

export type LeadOption = { id: string; name: string; phone: string | null };

/**
 * Header control on the trip workspace for connecting a trip to a CRM
 * contact. A trip created standalone (no contactId) would otherwise never
 * reach the contact's timeline, customer LTV, or source attribution —
 * this is the way to fix that after the fact.
 */
export function LinkLeadControl({
  tripId,
  contact,
  leads,
  canEdit,
}: {
  tripId: string;
  contact: { id: string; name: string } | null;
  leads: LeadOption[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Read-only roles just see the link (or nothing).
  if (!canEdit) {
    return contact ? <LinkedChip contact={contact} /> : null;
  }

  return (
    <>
      {contact ? (
        <span className="inline-flex items-center gap-1.5">
          <LinkedChip contact={contact} />
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-ivory hover:text-navy transition-colors"
            aria-label="Change linked contact"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </span>
      ) : (
        // Amber call-to-action with a pulsing dot — an unlinked trip is an
        // incomplete-data state, so it should visibly ask to be fixed.
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-soft transition-colors hover:bg-amber-100 hover:border-amber-400"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <Link2 className="h-3.5 w-3.5" />
          Link to contact
        </button>
      )}

      <LinkLeadDialog
        tripId={tripId}
        currentLeadId={contact?.id ?? null}
        leads={leads}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function LinkedChip({ contact }: { contact: { id: string; name: string } }) {
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-navy transition-colors"
    >
      <UserRound className="h-3.5 w-3.5" />
      {contact.name}
    </Link>
  );
}

function LinkLeadDialog({
  tripId,
  currentLeadId,
  leads,
  open,
  onOpenChange,
}: {
  tripId: string;
  currentLeadId: string | null;
  leads: LeadOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q)
    );
  }, [leads, query]);

  function link(contactId: string) {
    setBusyId(contactId);
    startTransition(async () => {
      try {
        const res = await linkTripToLeadAction({ tripId, contactId });
        if (!res.ok) throw new Error(res.error);
        toast.success("Trip linked to contact");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't link");
      } finally {
        setBusyId(null);
      }
    });
  }

  function unlink() {
    setBusyId("__unlink__");
    startTransition(async () => {
      try {
        const res = await unlinkTripFromLeadAction(tripId);
        if (!res.ok) throw new Error(res.error);
        toast.success("Trip unlinked");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't unlink");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentLeadId ? "Change linked contact" : "Link trip to a contact"}
          </DialogTitle>
          <DialogDescription>
            Connecting the trip threads it into the contact&apos;s timeline,
            lifetime value and source reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No contacts match.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((l) => {
                const isCurrent = l.id === currentLeadId;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => !isCurrent && link(l.id)}
                      disabled={isPending || isCurrent}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                        isCurrent
                          ? "border-line bg-ivory cursor-default"
                          : "border-line bg-white hover:border-navy/40 hover:bg-ivory disabled:opacity-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-navy truncate">
                          {l.name}
                        </span>
                        {l.phone && (
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {l.phone}
                          </span>
                        )}
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Linked
                        </span>
                      ) : busyId === l.id ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-navy" />
                      ) : (
                        <Link2 className="h-4 w-4 shrink-0 text-sand-700" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {currentLeadId && (
          <div className="flex justify-between border-t border-line pt-4">
            <Button
              variant="ghost"
              onClick={unlink}
              disabled={isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {busyId === "__unlink__" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Unlink contact
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
