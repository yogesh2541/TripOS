"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerPreferencesAction } from "@/server/actions/customers";

export type CustomerPreferences = {
  dietary?: string | null;
  hotels?: string | null;
  travelStyle?: string | null;
  other?: string | null;
};

export function CustomerPreferencesPanel({
  contactId,
  initial,
}: {
  contactId: string;
  initial: CustomerPreferences;
}) {
  const [editing, setEditing] = useState(false);
  const [prefs, setPrefs] = useState<CustomerPreferences>(initial);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateCustomerPreferencesAction({
          contactId,
          preferences: prefs,
        });
        toast.success("Preferences saved");
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  const empty =
    !prefs.dietary && !prefs.hotels && !prefs.travelStyle && !prefs.other;

  return (
    <section className="rounded-lg border border-line bg-paper p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="tc-eyebrow gold">
          Preferences
        </p>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setPrefs(initial);
                setEditing(false);
              }}
              className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={save}
              disabled={isPending}
              className="text-xs text-ink hover:text-gold-deep transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Field
            label="Dietary"
            value={prefs.dietary ?? ""}
            onChange={(v) => setPrefs((p) => ({ ...p, dietary: v }))}
          />
          <Field
            label="Hotels"
            value={prefs.hotels ?? ""}
            onChange={(v) => setPrefs((p) => ({ ...p, hotels: v }))}
          />
          <Field
            label="Travel style"
            value={prefs.travelStyle ?? ""}
            onChange={(v) => setPrefs((p) => ({ ...p, travelStyle: v }))}
          />
          <div className="space-y-1.5">
            <Label className="text-[10px]">Other</Label>
            <Textarea
              rows={3}
              value={prefs.other ?? ""}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, other: e.target.value }))
              }
              className="text-sm"
            />
          </div>
        </div>
      ) : empty ? (
        <p className="text-xs text-muted italic">
          No preferences captured.
        </p>
      ) : (
        <div className="space-y-2 text-sm">
          {prefs.dietary && (
            <Row label="Dietary" value={prefs.dietary} />
          )}
          {prefs.hotels && <Row label="Hotels" value={prefs.hotels} />}
          {prefs.travelStyle && (
            <Row label="Style" value={prefs.travelStyle} />
          )}
          {prefs.other && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-0.5">
                Other
              </p>
              <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                {prefs.other}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px]">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted pt-0.5">
        {label}
      </span>
      <span className="text-ink/80">{value}</span>
    </div>
  );
}
