"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Loader2,
  Pencil,
  Plane,
  Plus,
  Trash2,
  TriangleAlert,
  UserPlus,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTravelerAction,
  deleteTravelerAction,
  updateTravelerAction,
} from "@/server/actions/travelers";
import { COUNTRIES, GENDERS } from "@/lib/countries";

// --- types -----------------------------------------------------------------

export type Relationship =
  | "SELF"
  | "SPOUSE"
  | "CHILD"
  | "PARENT"
  | "SIBLING"
  | "FRIEND"
  | "COLLEAGUE"
  | "OTHER";

export type LoyaltyEntry = { program: string; number: string };

/** Wire shape passed from the contact page — dates pre-serialised to ISO. */
export type TravelerView = {
  id: string;
  fullName: string;
  relationship: Relationship;
  isPrimary: boolean;
  dateOfBirth: string | null;
  gender: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportIssueCountry: string | null;
  visaNotes: string | null;
  dietary: string | null;
  loyaltyNumbers: LoyaltyEntry[];
  phone: string | null;
  email: string | null;
  notes: string | null;
};

const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  SELF: "Primary contact",
  SPOUSE: "Spouse / partner",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  FRIEND: "Friend",
  COLLEAGUE: "Colleague",
  OTHER: "Companion",
};

const RELATIONSHIPS: Relationship[] = [
  "SELF",
  "SPOUSE",
  "CHILD",
  "PARENT",
  "SIBLING",
  "FRIEND",
  "COLLEAGUE",
  "OTHER",
];

// --- date / passport helpers -----------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ageFrom(iso: string | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

type PassportFlag = { tone: "ok" | "warn" | "danger"; label: string } | null;

function passportFlag(iso: string | null): PassportFlag {
  if (!iso) return null;
  const expiry = new Date(iso);
  const now = new Date();
  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());
  if (expiry.getTime() < now.getTime())
    return { tone: "danger", label: "Passport expired" };
  // Most countries require 6 months' validity beyond the travel date.
  if (months < 6) return { tone: "warn", label: "Expires within 6 months" };
  return { tone: "ok", label: `Valid till ${fmtDate(iso)}` };
}

// --- panel -----------------------------------------------------------------

export function TravelerProfilesPanel({
  contactId,
  travelers,
  canEdit,
}: {
  contactId: string;
  travelers: TravelerView[];
  canEdit: boolean;
}) {
  if (travelers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-12 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ivory border border-line text-sand-700">
          <UserPlus className="h-5 w-5" />
        </span>
        <p className="mt-4 font-display text-xl text-navy">
          No traveller profiles yet
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
          Capture passports, dates of birth, dietary needs and loyalty numbers
          once — reuse them on every trip without chasing the client again.
        </p>
        {canEdit && (
          <div className="mt-5">
            <TravelerFormDialog
              contactId={contactId}
              trigger={
                <Button>
                  <Plus className="h-4 w-4" />
                  Add traveller
                </Button>
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {travelers.length} traveller{travelers.length === 1 ? "" : "s"} on
          this account
        </p>
        {canEdit && (
          <TravelerFormDialog
            contactId={contactId}
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add traveller
              </Button>
            }
          />
        )}
      </div>
      <ul className="space-y-3">
        {travelers.map((t) => (
          <li key={t.id}>
            <TravelerCard contactId={contactId} traveler={t} canEdit={canEdit} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- card ------------------------------------------------------------------

function TravelerCard({
  contactId,
  traveler: t,
  canEdit,
}: {
  contactId: string;
  traveler: TravelerView;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const flag = passportFlag(t.passportExpiry);
  const age = ageFrom(t.dateOfBirth);

  function remove() {
    if (!confirm(`Remove ${t.fullName} from this account?`)) return;
    startTransition(async () => {
      try {
        await deleteTravelerAction(t.id);
        toast.success("Traveller removed");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display text-xl text-navy">{t.fullName}</p>
            {t.isPrimary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2 py-0.5 text-[10px] font-medium text-ivory">
                <BadgeCheck className="h-3 w-3" />
                Primary
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {RELATIONSHIP_LABEL[t.relationship]}
            {age !== null ? ` · ${age} yrs` : ""}
            {t.nationality ? ` · ${t.nationality}` : ""}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <TravelerFormDialog
              contactId={contactId}
              traveler={t}
              trigger={
                <button
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-ivory hover:text-navy transition-colors"
                  aria-label="Edit traveller"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              }
            />
            <button
              onClick={remove}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              aria-label="Remove traveller"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Passport status — the field most likely to derail a booking. */}
      {flag && (
        <div
          className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
            flag.tone === "danger"
              ? "bg-red-50 text-red-700 border border-red-100"
              : flag.tone === "warn"
                ? "bg-amber-50 text-amber-800 border border-amber-100"
                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          }`}
        >
          {flag.tone === "ok" ? (
            <BadgeCheck className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
          {flag.label}
        </div>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Detail label="Date of birth" value={fmtDate(t.dateOfBirth)} />
        <Detail
          label="Passport no."
          value={t.passportNumber || "—"}
          icon={<Plane className="h-3 w-3" />}
        />
        {t.passportIssueCountry && (
          <Detail label="Issued in" value={t.passportIssueCountry} />
        )}
        {t.gender && <Detail label="Gender" value={t.gender} />}
        {t.dietary && (
          <Detail
            label="Dietary"
            value={t.dietary}
            icon={<Utensils className="h-3 w-3" />}
          />
        )}
        {(t.phone || t.email) && (
          <Detail
            label="Contact"
            value={[t.phone, t.email].filter(Boolean).join(" · ")}
          />
        )}
        {t.visaNotes && (
          <Detail label="Visa" value={t.visaNotes} className="sm:col-span-2" />
        )}
      </dl>

      {t.loyaltyNumbers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.loyaltyNumbers.map((l, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ivory px-2.5 py-1 text-[11px] text-ink/80"
            >
              <span className="text-sand-700">{l.program}</span>
              <span className="font-medium tabular-nums">{l.number}</span>
            </span>
          ))}
        </div>
      )}

      {t.notes && (
        <p className="mt-3 text-sm text-ink/70 whitespace-pre-line leading-relaxed">
          {t.notes}
        </p>
      )}
    </article>
  );
}

function Detail({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

// --- form dialog -----------------------------------------------------------

type FormState = {
  fullName: string;
  relationship: Relationship;
  isPrimary: boolean;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  passportIssueCountry: string;
  visaNotes: string;
  dietary: string;
  loyaltyNumbers: LoyaltyEntry[];
  phone: string;
  email: string;
  notes: string;
};

function toForm(t?: TravelerView): FormState {
  return {
    fullName: t?.fullName ?? "",
    relationship: t?.relationship ?? "OTHER",
    isPrimary: t?.isPrimary ?? false,
    dateOfBirth: t?.dateOfBirth?.slice(0, 10) ?? "",
    gender: t?.gender ?? "",
    nationality: t?.nationality ?? "",
    passportNumber: t?.passportNumber ?? "",
    passportExpiry: t?.passportExpiry?.slice(0, 10) ?? "",
    passportIssueCountry: t?.passportIssueCountry ?? "",
    visaNotes: t?.visaNotes ?? "",
    dietary: t?.dietary ?? "",
    loyaltyNumbers: t?.loyaltyNumbers ?? [],
    phone: t?.phone ?? "",
    email: t?.email ?? "",
    notes: t?.notes ?? "",
  };
}

function TravelerFormDialog({
  contactId,
  traveler,
  trigger,
}: {
  contactId: string;
  traveler?: TravelerView;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => toForm(traveler));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Reset to a clean copy each time the dialog opens.
  function onOpenChange(next: boolean) {
    if (next) setForm(toForm(traveler));
    setOpen(next);
  }

  function submit() {
    startTransition(async () => {
      try {
        const payload = {
          contactId,
          ...form,
          loyaltyNumbers: form.loyaltyNumbers.filter(
            (l) => l.program.trim() || l.number.trim()
          ),
        };
        if (traveler) {
          await updateTravelerAction(traveler.id, payload);
          toast.success("Traveller updated");
        } else {
          await createTravelerAction(payload);
          toast.success("Traveller added");
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {traveler ? "Edit traveller" : "Add traveller"}
          </DialogTitle>
          <DialogDescription>
            Stored once, reused on every trip — passports, preferences and
            loyalty numbers never need re-asking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="tv-name">Full name (as on passport)</Label>
            <Input
              id="tv-name"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Relationship</Label>
            <Select
              value={form.relationship}
              onValueChange={(v) => update("relationship", v as Relationship)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {RELATIONSHIP_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tv-dob">Date of birth</Label>
            <Input
              id="tv-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => update("dateOfBirth", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select
              value={form.gender || undefined}
              onValueChange={(v) => update("gender", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nationality</Label>
            <Select
              value={form.nationality || undefined}
              onValueChange={(v) => update("nationality", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tv-ppno">Passport number</Label>
            <Input
              id="tv-ppno"
              value={form.passportNumber}
              onChange={(e) =>
                update("passportNumber", e.target.value.toUpperCase())
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-ppexp">Passport expiry</Label>
            <Input
              id="tv-ppexp"
              type="date"
              value={form.passportExpiry}
              onChange={(e) => update("passportExpiry", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tv-ppc">Passport issued in</Label>
            <Input
              id="tv-ppc"
              value={form.passportIssueCountry}
              onChange={(e) => update("passportIssueCountry", e.target.value)}
              placeholder="India"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-visa">Visa notes</Label>
            <Input
              id="tv-visa"
              value={form.visaNotes}
              onChange={(e) => update("visaNotes", e.target.value)}
              placeholder="e.g. Schengen valid till Mar 2027"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tv-diet">Dietary</Label>
            <Input
              id="tv-diet"
              value={form.dietary}
              onChange={(e) => update("dietary", e.target.value)}
              placeholder="Vegetarian, no nuts"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-phone">Phone</Label>
            <Input
              id="tv-phone"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="tv-email">Email</Label>
            <Input
              id="tv-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Loyalty programs — repeatable rows */}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Loyalty / frequent flyer numbers</Label>
              <button
                type="button"
                onClick={() =>
                  update("loyaltyNumbers", [
                    ...form.loyaltyNumbers,
                    { program: "", number: "" },
                  ])
                }
                className="text-xs text-navy hover:text-sand-700 transition-colors inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
            {form.loyaltyNumbers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                None added.
              </p>
            ) : (
              <div className="space-y-2">
                {form.loyaltyNumbers.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={l.program}
                      onChange={(e) => {
                        const next = [...form.loyaltyNumbers];
                        next[i] = { ...next[i], program: e.target.value };
                        update("loyaltyNumbers", next);
                      }}
                      placeholder="Programme (e.g. Marriott Bonvoy)"
                    />
                    <Input
                      value={l.number}
                      onChange={(e) => {
                        const next = [...form.loyaltyNumbers];
                        next[i] = { ...next[i], number: e.target.value };
                        update("loyaltyNumbers", next);
                      }}
                      placeholder="Member no."
                    />
                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "loyaltyNumbers",
                          form.loyaltyNumbers.filter((_, j) => j !== i)
                        )
                      }
                      className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="tv-notes">Notes</Label>
            <Textarea
              id="tv-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>

          <label className="sm:col-span-2 flex items-center gap-2.5 rounded-xl border border-line bg-ivory/60 px-3.5 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => update("isPrimary", e.target.checked)}
              className="h-4 w-4 rounded border-line accent-navy"
            />
            <span className="flex items-center gap-1.5 text-sm text-ink">
              <CalendarDays className="h-3.5 w-3.5 text-sand-700" />
              Primary contact for this account
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || form.fullName.trim().length === 0}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {traveler ? "Save changes" : "Add traveller"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
