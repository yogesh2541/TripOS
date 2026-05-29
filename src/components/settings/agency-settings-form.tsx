"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  saveAgencySettingsAction,
  type AgencySettingsInput,
} from "@/server/actions/agency-settings";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { INDIA_STATES } from "@/lib/gst";

const TAX_SCHEMES = [
  { value: "GST_5_NO_ITC", label: "5% (without ITC) — Tour operator default" },
  { value: "GST_18_REGULAR", label: "18% (regular regime, with ITC)" },
  { value: "EXEMPT", label: "Exempt (exports / SEZ)" },
] as const;

// SERVICE_FEE_ONLY is intentionally omitted — there's no per-line fee field
// yet, so it would silently tax the full amount. Hidden until implemented.
const BASES = [
  { value: "FULL_AMOUNT", label: "Full invoice amount" },
  { value: "MARGIN_ONLY", label: "Margin only (advanced)" },
] as const;

const SAC_SUGGESTIONS = [
  { code: "998552", label: "998552 — Reservation services for accommodation" },
  { code: "998555", label: "998555 — Tour operator services" },
  { code: "998551", label: "998551 — Reservation services for transportation" },
];

export function AgencySettingsForm({
  initial,
}: {
  initial: Partial<AgencySettingsInput> | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<AgencySettingsInput>({
    legalName: initial?.legalName ?? "",
    tradeName: initial?.tradeName ?? "",
    gstin: initial?.gstin ?? "",
    pan: initial?.pan ?? "",
    logoUrl: initial?.logoUrl ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    stateCode: initial?.stateCode ?? "",
    pincode: initial?.pincode ?? "",
    country: initial?.country ?? "India",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    authorizedSignatory: initial?.authorizedSignatory ?? "",
    signatoryDesignation: initial?.signatoryDesignation ?? "",
    invoicePrefix: initial?.invoicePrefix ?? "TC",
    defaultTaxScheme: initial?.defaultTaxScheme ?? "GST_5_NO_ITC",
    defaultTaxableBasis: initial?.defaultTaxableBasis ?? "FULL_AMOUNT",
    defaultSacCode: initial?.defaultSacCode ?? "998552",
    defaultPlaceOfSupplyState: initial?.defaultPlaceOfSupplyState ?? "",
    defaultPlaceOfSupplyStateCode:
      initial?.defaultPlaceOfSupplyStateCode ?? "",
    bankName: initial?.bankName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    bankIfscCode: initial?.bankIfscCode ?? "",
    bankAccountHolder: initial?.bankAccountHolder ?? "",
    invoiceTerms: initial?.invoiceTerms ?? "",
    invoiceNotes: initial?.invoiceNotes ?? "",
    eInvoiceEnabled: initial?.eInvoiceEnabled ?? false,
    eWayBillEnabled: initial?.eWayBillEnabled ?? false,
  });

  function update<K extends keyof AgencySettingsInput>(
    key: K,
    value: AgencySettingsInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickState(code: string) {
    const match = INDIA_STATES.find((s) => s.code === code);
    update("stateCode", code);
    update("state", match?.name ?? "");
  }
  function pickPlaceOfSupply(code: string) {
    const match = INDIA_STATES.find((s) => s.code === code);
    update("defaultPlaceOfSupplyStateCode", code);
    update("defaultPlaceOfSupplyState", match?.name ?? "");
  }

  // Dirty-state guard: warn before leaving with unsaved edits. The snapshot
  // is the last-saved serialization of the form; `dirty` is true whenever
  // the live form diverges from it.
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(form)
  );
  const dirty = JSON.stringify(form) !== savedSnapshot;
  useUnsavedChanges(dirty);

  function submit() {
    startTransition(async () => {
      try {
        await saveAgencySettingsAction(form);
        setSavedSnapshot(JSON.stringify(form));
        toast.success("Settings saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Identity */}
      <Card title="Agency identity" hint="Shown as the supplier on every invoice.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal business name" required>
            <Input
              value={form.legalName}
              onChange={(e) => update("legalName", e.target.value)}
              placeholder="e.g. Wanderwarrior Travels Pvt Ltd"
            />
          </Field>
          <Field label="Trade name (if different)">
            <Input
              value={form.tradeName ?? ""}
              onChange={(e) => update("tradeName", e.target.value)}
            />
          </Field>
          <Field label="GSTIN" hint="15 chars, e.g. 27AAACT1234A1ZS">
            <Input
              value={form.gstin ?? ""}
              onChange={(e) => update("gstin", e.target.value.toUpperCase())}
              maxLength={15}
              placeholder="27AAACT1234A1ZS"
            />
          </Field>
          <Field label="PAN">
            <Input
              value={form.pan ?? ""}
              onChange={(e) => update("pan", e.target.value.toUpperCase())}
              maxLength={10}
              placeholder="AAACT1234A"
            />
          </Field>
        </div>
      </Card>

      {/* Branding */}
      <Card
        title="Branding"
        hint="Your logo appears on shared proposals, invoices, vouchers and the public quote pages your customers open."
      >
        <div className="grid gap-4 sm:grid-cols-[200px_1fr] items-start">
          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => update("logoUrl", url ?? "")}
            height="h-32"
            label="Upload logo"
          />
          <div className="text-xs text-muted-foreground space-y-2 pt-1">
            <p>
              Square or near-square images render best (we display logos in a
              circular crop on the public proposal header).
            </p>
            <p>JPG, PNG, WEBP, GIF, or AVIF — up to 8 MB.</p>
            <p>
              {form.logoUrl ? (
                <span className="text-ok">
                  ✓ Logo set — customers will see your brand on shared
                  proposals.
                </span>
              ) : (
                "Without a logo, customers see the default TripCraft mark on shared pages."
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Address */}
      <Card title="Registered address" hint="Drives intra-state vs inter-state tax split.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" className="sm:col-span-2">
            <Input
              value={form.addressLine1 ?? ""}
              onChange={(e) => update("addressLine1", e.target.value)}
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input
              value={form.addressLine2 ?? ""}
              onChange={(e) => update("addressLine2", e.target.value)}
            />
          </Field>
          <Field label="City">
            <Input
              value={form.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
            />
          </Field>
          <Field label="State">
            <Select
              value={form.stateCode ?? ""}
              onValueChange={pickState}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIA_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pincode">
            <Input
              value={form.pincode ?? ""}
              onChange={(e) => update("pincode", e.target.value)}
              maxLength={6}
            />
          </Field>
          <Field label="Country">
            <Input
              value={form.country ?? "India"}
              onChange={(e) => update("country", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {/* Contact + signatory */}
      <Card title="Contact & signatory">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91 …"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website ?? ""}
              onChange={(e) => update("website", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <div /> {/* spacer */}
          <Field label="Authorised signatory">
            <Input
              value={form.authorizedSignatory ?? ""}
              onChange={(e) =>
                update("authorizedSignatory", e.target.value)
              }
              placeholder="e.g. Yogesh Sharma"
            />
          </Field>
          <Field label="Signatory designation">
            <Input
              value={form.signatoryDesignation ?? ""}
              onChange={(e) =>
                update("signatoryDesignation", e.target.value)
              }
              placeholder="e.g. Director"
            />
          </Field>
        </div>
      </Card>

      {/* Invoice config */}
      <Card
        title="Invoice configuration"
        hint="Defaults that pre-fill new invoices. Each invoice can override at issue time."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice number prefix"
            required
            hint="Used in {PREFIX}/{FY}/{NNNN}"
          >
            <Input
              value={form.invoicePrefix}
              onChange={(e) =>
                update("invoicePrefix", e.target.value.toUpperCase())
              }
              maxLength={10}
            />
          </Field>
          <Field label="Default SAC code">
            <Input
              value={form.defaultSacCode}
              onChange={(e) => update("defaultSacCode", e.target.value)}
              maxLength={10}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SAC_SUGGESTIONS.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => update("defaultSacCode", s.code)}
                  className="text-[10px] rounded-[6px] border border-line bg-paper px-2 py-0.5 hover:border-[var(--gold-line)] text-muted"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Default GST scheme">
            <Select
              value={form.defaultTaxScheme}
              onValueChange={(v) =>
                update("defaultTaxScheme", v as AgencySettingsInput["defaultTaxScheme"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_SCHEMES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Default taxable basis"
            hint="Most agencies should use Full Amount."
          >
            <Select
              value={form.defaultTaxableBasis}
              onValueChange={(v) =>
                update(
                  "defaultTaxableBasis",
                  v as AgencySettingsInput["defaultTaxableBasis"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Default place of supply"
            hint="Used when the recipient contact has no billing state set."
            className="sm:col-span-2"
          >
            <Select
              value={form.defaultPlaceOfSupplyStateCode ?? ""}
              onValueChange={pickPlaceOfSupply}
            >
              <SelectTrigger>
                <SelectValue placeholder="Defaults to your registered state" />
              </SelectTrigger>
              <SelectContent>
                {INDIA_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Bank */}
      <Card title="Bank details (optional)" hint="Printed at the bottom of issued invoices.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <Input
              value={form.bankName ?? ""}
              onChange={(e) => update("bankName", e.target.value)}
            />
          </Field>
          <Field label="Account holder">
            <Input
              value={form.bankAccountHolder ?? ""}
              onChange={(e) => update("bankAccountHolder", e.target.value)}
            />
          </Field>
          <Field label="Account number">
            <Input
              value={form.bankAccountNumber ?? ""}
              onChange={(e) => update("bankAccountNumber", e.target.value)}
            />
          </Field>
          <Field label="IFSC code">
            <Input
              value={form.bankIfscCode ?? ""}
              onChange={(e) =>
                update("bankIfscCode", e.target.value.toUpperCase())
              }
              maxLength={11}
            />
          </Field>
        </div>
      </Card>

      {/* Terms / notes */}
      <Card title="Invoice footer">
        <Field label="Terms & conditions" className="mb-3">
          <Textarea
            rows={3}
            value={form.invoiceTerms ?? ""}
            onChange={(e) => update("invoiceTerms", e.target.value)}
            placeholder="Payment is due within 7 days of issue. Late payments attract interest at 18% p.a…"
          />
        </Field>
        <Field label="Internal notes (always shown to recipient)">
          <Textarea
            rows={2}
            value={form.invoiceNotes ?? ""}
            onChange={(e) => update("invoiceNotes", e.target.value)}
          />
        </Field>
      </Card>

      {/* Future flags */}
      <Card
        title="Compliance flags"
        hint="Reserved for upcoming integrations — leave off until needed."
      >
        <div className="space-y-2">
          <label className="flex items-center gap-3 rounded-[10px] border border-line bg-paper px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.eInvoiceEnabled ?? false}
              onChange={(e) => update("eInvoiceEnabled", e.target.checked)}
              className="h-4 w-4 accent-[var(--gold-line)]"
            />
            <span>
              <span className="font-medium text-ink">e-Invoicing (IRP)</span>
              <span className="ml-2 text-xs text-muted">
                Required when turnover crosses the prescribed threshold (you
                decide when).
              </span>
            </span>
          </label>
          <label className="flex items-center gap-3 rounded-[10px] border border-line bg-paper px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.eWayBillEnabled ?? false}
              onChange={(e) => update("eWayBillEnabled", e.target.checked)}
              className="h-4 w-4 accent-[var(--gold-line)]"
            />
            <span>
              <span className="font-medium text-ink">e-Way Bill</span>
              <span className="ml-2 text-xs text-muted">
                Off by default; rarely applicable to pure travel services.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {dirty ? (
          <span className="rounded-[6px] border border-[var(--gold-line)] bg-gold-soft px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-gold-deep shadow-soft">
            Unsaved changes
          </span>
        ) : null}
        <Button onClick={submit} disabled={isPending || !dirty}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {dirty ? "Save settings" : "Saved"}
        </Button>
      </div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-paper p-6 shadow-soft">
      <header className="mb-4">
        <h3 className="font-display text-xl text-ink">{title}</h3>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted">{hint}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="flex items-center gap-1">
        {label}
        {required ? <span className="text-bad">*</span> : null}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
