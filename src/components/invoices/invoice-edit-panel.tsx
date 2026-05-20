"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Invoice, InvoiceItem } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateDraftInvoiceAction } from "@/server/actions/invoices";
import { INDIA_STATES } from "@/lib/gst";
import { cn, formatINR } from "@/lib/utils";

type Line = {
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  cost: number | null;
};

const TAX_SCHEMES = [
  { value: "GST_5_NO_ITC", label: "GST 5% (without ITC)" },
  { value: "GST_18_REGULAR", label: "GST 18% (regular)" },
  { value: "EXEMPT", label: "Exempt" },
] as const;

const BASES = [
  { value: "FULL_AMOUNT", label: "Full amount" },
  { value: "SERVICE_FEE_ONLY", label: "Service fee" },
  { value: "MARGIN_ONLY", label: "Margin (selling − cost)" },
] as const;

export function InvoiceEditPanel({
  invoice,
  defaultSacCode,
}: {
  invoice: Invoice & { items: InvoiceItem[] };
  defaultSacCode: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [scheme, setScheme] = useState<Invoice["taxScheme"]>(invoice.taxScheme);
  const [basis, setBasis] = useState<Invoice["taxableBasis"]>(invoice.taxableBasis);
  const [posCode, setPosCode] = useState(invoice.placeOfSupplyStateCode ?? "");
  const [lines, setLines] = useState<Line[]>(
    invoice.items.length > 0
      ? invoice.items.map((it) => ({
          description: it.description,
          sacCode: it.sacCode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          cost: it.cost,
        }))
      : []
  );

  function updateLine<K extends keyof Line>(i: number, key: K, value: Line[K]) {
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addLine() {
    setLines((rows) => [
      ...rows,
      {
        description: "",
        sacCode: defaultSacCode,
        quantity: 1,
        unitPrice: 0,
        cost: null,
      },
    ]);
  }
  function removeLine(i: number) {
    setLines((rows) => rows.filter((_, idx) => idx !== i));
  }

  // Live preview totals (mirror the tax service rules)
  const preview = computePreview({
    scheme,
    basis,
    posCode,
    supplierCode: getSupplierStateCode(invoice),
    lines,
  });

  function save() {
    if (lines.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (lines.some((l) => !l.description.trim())) {
      toast.error("Every line needs a description");
      return;
    }

    const placeOfSupplyState =
      INDIA_STATES.find((s) => s.code === posCode)?.name ?? null;

    startTransition(async () => {
      try {
        await updateDraftInvoiceAction({
          invoiceId: invoice.id,
          scheme,
          basis,
          placeOfSupplyState,
          placeOfSupplyStateCode: posCode || null,
          lines: lines.map((l, i) => ({
            description: l.description.trim(),
            sacCode: l.sacCode,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            cost: l.cost ?? null,
            position: i,
          })),
        });
        toast.success("Draft saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white shadow-soft">
      <header className="border-b border-line/70 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-xl text-navy">Edit draft</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live preview totals on the right. Save to persist; only DRAFT
            invoices can be edited.
          </p>
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save draft
        </Button>
      </header>

      <div className="p-5 space-y-5">
        {/* Scheme + basis + POS */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="GST scheme">
            <Select value={scheme} onValueChange={(v) => setScheme(v as never)}>
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
          <Field label="Taxable basis">
            <Select value={basis} onValueChange={(v) => setBasis(v as never)}>
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
          <Field label="Place of supply">
            <Select value={posCode} onValueChange={setPosCode}>
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
        </div>

        {/* Lines */}
        <div>
          <header className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Line items
            </p>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </header>

          <div className="space-y-2">
            {lines.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line/70 bg-ivory p-6 text-center text-xs text-muted-foreground">
                No line items yet. Add one to start.
              </div>
            ) : (
              lines.map((l, i) => (
                <LineRow
                  key={i}
                  line={l}
                  basis={basis}
                  onChange={(k, v) => updateLine(i, k, v)}
                  onRemove={() => removeLine(i)}
                />
              ))
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-line bg-ivory/40 p-4 grid gap-2 text-sm">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Live preview · Won't persist until you save
          </p>
          <PreviewRow label="Subtotal (taxable)" value={preview.subtotal} />
          {preview.cgst > 0 ? (
            <PreviewRow
              label={`CGST (${preview.taxRatePct / 2}%)`}
              value={preview.cgst}
            />
          ) : null}
          {preview.sgst > 0 ? (
            <PreviewRow
              label={`SGST (${preview.taxRatePct / 2}%)`}
              value={preview.sgst}
            />
          ) : null}
          {preview.igst > 0 ? (
            <PreviewRow
              label={`IGST (${preview.taxRatePct}%)`}
              value={preview.igst}
            />
          ) : null}
          <div className="flex items-center justify-between pt-2 border-t border-line">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Grand total
            </span>
            <span className="font-display text-xl text-navy tabular-nums">
              {formatINR(preview.grandTotal)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {preview.isIntra
              ? `Intra-state — supplier and place of supply both ${INDIA_STATES.find((s) => s.code === preview.supplierCode)?.name ?? "—"}.`
              : preview.supplierCode && posCode
                ? `Inter-state — IGST applied (supplier ${preview.supplierCode}, place of supply ${posCode}).`
                : "Pick a place of supply to determine CGST+SGST vs IGST split."}
          </p>
        </div>
      </div>
    </section>
  );
}

function LineRow({
  line,
  basis,
  onChange,
  onRemove,
}: {
  line: Line;
  basis: Invoice["taxableBasis"];
  onChange: <K extends keyof Line>(k: K, v: Line[K]) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-3 space-y-2">
      <div className="grid gap-2 grid-cols-1 md:grid-cols-[3fr_1fr_auto]">
        <Input
          value={line.description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Description (shown on invoice)"
        />
        <Input
          value={line.sacCode}
          onChange={(e) => onChange("sacCode", e.target.value)}
          placeholder="SAC"
          maxLength={10}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove line"
          className="h-9 w-9 text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        className={cn(
          "grid gap-2 grid-cols-2",
          basis === "MARGIN_ONLY" && "grid-cols-3"
        )}
      >
        <NumField
          label="Qty"
          value={line.quantity}
          onChange={(n) => onChange("quantity", n)}
        />
        <NumField
          label="Unit price"
          value={line.unitPrice}
          onChange={(n) => onChange("unitPrice", n)}
        />
        {basis === "MARGIN_ONLY" ? (
          <NumField
            label="Cost (for margin)"
            value={line.cost ?? 0}
            onChange={(n) => onChange("cost", n)}
          />
        ) : null}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        min={0}
        value={value === 0 ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="mt-1"
      />
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-navy">{formatINR(value)}</span>
    </div>
  );
}

// --- preview math (mirrors invoice-tax service rules) ----------------------

function getSupplierStateCode(invoice: Invoice & { items: InvoiceItem[] }): string | null {
  const supplier = invoice.supplierSnapshot as
    | { address?: { stateCode?: string | null } | null }
    | null;
  return supplier?.address?.stateCode ?? null;
}

function computePreview(input: {
  scheme: Invoice["taxScheme"];
  basis: Invoice["taxableBasis"];
  posCode: string;
  supplierCode: string | null;
  lines: Line[];
}) {
  const RATE: Record<string, number> = {
    GST_5_NO_ITC: 5,
    GST_18_REGULAR: 18,
    EXEMPT: 0,
  };
  const taxRatePct = RATE[input.scheme];
  const isIntra =
    !!input.supplierCode &&
    !!input.posCode &&
    input.supplierCode === input.posCode;

  let subtotal = 0;
  let gross = 0;
  for (const l of input.lines) {
    const lineTotal = round2(l.quantity * l.unitPrice);
    gross += lineTotal;
    if (input.basis === "MARGIN_ONLY" && typeof l.cost === "number") {
      subtotal += Math.max(0, round2(lineTotal - l.cost));
    } else {
      subtotal += lineTotal;
    }
  }
  subtotal = round2(subtotal);
  gross = round2(gross);
  const tax = round2((subtotal * taxRatePct) / 100);
  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (taxRatePct > 0) {
    if (isIntra) {
      cgst = round2(tax / 2);
      sgst = round2(tax - cgst);
    } else {
      igst = tax;
    }
  }
  const grandTotal = Math.round(gross + tax);

  return {
    taxRatePct,
    isIntra,
    supplierCode: input.supplierCode,
    subtotal,
    cgst,
    sgst,
    igst,
    grandTotal,
  };
}
function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
