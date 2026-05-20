import type { Invoice, InvoiceItem } from "@prisma/client";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { STATE_NAME_BY_CODE } from "@/lib/gst";

type Snapshot = {
  legalName?: string | null;
  tradeName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    stateCode?: string | null;
    pincode?: string | null;
    country?: string | null;
  } | null;
  contact?: {
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  signatory?: {
    name?: string | null;
    designation?: string | null;
  } | null;
  bank?: {
    name?: string | null;
    accountNumber?: string | null;
    ifsc?: string | null;
    holder?: string | null;
  } | null;
  invoiceTerms?: string | null;
  invoiceNotes?: string | null;
  // Recipient-only:
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const SCHEME_LABEL: Record<string, string> = {
  GST_5_NO_ITC: "GST 5% (without ITC)",
  GST_18_REGULAR: "GST 18% (regular)",
  EXEMPT: "Exempt",
};

const BASIS_LABEL: Record<string, string> = {
  FULL_AMOUNT: "Full amount",
  SERVICE_FEE_ONLY: "Service fee",
  MARGIN_ONLY: "Margin",
};

export function InvoicePreview({
  invoice,
}: {
  invoice: Invoice & { items: InvoiceItem[] };
}) {
  const supplier = (invoice.supplierSnapshot as Snapshot | null) ?? null;
  const recipient = (invoice.recipientSnapshot as Snapshot | null) ?? null;
  const isIntraState = invoice.cgstAmount + invoice.sgstAmount > 0;

  return (
    <article className="rounded-2xl border border-line bg-white shadow-soft overflow-hidden">
      {/* Hero band */}
      <header className="bg-navy text-ivory px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-sand-200/80">
              Tax Invoice
            </p>
            <h2 className="font-display text-2xl mt-1 leading-tight">
              {supplier?.legalName ?? "—"}
            </h2>
            {supplier?.tradeName ? (
              <p className="text-xs text-sand-200/80 mt-0.5">
                Trading as {supplier.tradeName}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-sand-200/80">
              Invoice
            </p>
            <p className="font-display tracking-wider mt-0.5 text-lg">
              {invoice.invoiceNumber ?? "DRAFT"}
            </p>
            <p className="text-[11px] text-sand-200/80 mt-0.5">
              {invoice.status === "ISSUED"
                ? `Issued ${formatDate(invoice.issuedAt!)}`
                : invoice.status === "CANCELLED"
                  ? `Cancelled ${formatDate(invoice.cancelledAt!)}`
                  : `Drafted ${formatDate(invoice.createdAt)}`}
            </p>
          </div>
        </div>
      </header>
      <div className="h-1 bg-sand" />

      {/* Body */}
      <div className="px-6 py-6 grid gap-6 md:grid-cols-2">
        {/* Supplier */}
        <Block label="Bill from">
          <p className="font-medium text-navy">{supplier?.legalName ?? "—"}</p>
          {supplier?.address?.line1 ? (
            <p className="text-sm text-ink/80">{supplier.address.line1}</p>
          ) : null}
          {supplier?.address?.line2 ? (
            <p className="text-sm text-ink/80">{supplier.address.line2}</p>
          ) : null}
          <p className="text-sm text-ink/80">
            {[
              supplier?.address?.city,
              supplier?.address?.state,
              supplier?.address?.pincode,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
          <KV label="GSTIN" value={supplier?.gstin} />
          <KV label="PAN" value={supplier?.pan} />
          <KV label="Phone" value={supplier?.contact?.phone} />
          <KV label="Email" value={supplier?.contact?.email} />
        </Block>

        {/* Recipient */}
        <Block label="Bill to">
          <p className="font-medium text-navy">{recipient?.name ?? "—"}</p>
          <KV label="GSTIN" value={recipient?.gstin} />
          <KV label="Email" value={recipient?.email} />
          <KV label="Phone" value={recipient?.phone} />
          <KV
            label="Place of supply"
            value={
              invoice.placeOfSupplyState ??
              (invoice.placeOfSupplyStateCode
                ? STATE_NAME_BY_CODE[invoice.placeOfSupplyStateCode]
                : null)
            }
          />
        </Block>
      </div>

      {/* Meta strip */}
      <div className="border-y border-line/70 bg-ivory/40 px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <Meta label="Date" value={formatDate(invoice.invoiceDate)} />
        <Meta label="Scheme" value={SCHEME_LABEL[invoice.taxScheme] ?? "—"} />
        <Meta label="Basis" value={BASIS_LABEL[invoice.taxableBasis] ?? "—"} />
        <Meta
          label="Tax type"
          value={
            invoice.taxRatePct === 0
              ? "—"
              : isIntraState
                ? "CGST + SGST"
                : "IGST"
          }
        />
      </div>

      {/* Items */}
      <div className="px-6 py-6">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <tr className="border-b border-line/70">
              <th className="text-left py-2">#</th>
              <th className="text-left py-2">Description</th>
              <th className="text-left py-2">SAC</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">Taxable</th>
              {isIntraState ? (
                <>
                  <th className="text-right py-2">CGST</th>
                  <th className="text-right py-2">SGST</th>
                </>
              ) : invoice.taxRatePct > 0 ? (
                <th className="text-right py-2">IGST</th>
              ) : null}
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {invoice.items.map((it, i) => {
              const lineTotal =
                it.quantity * it.unitPrice +
                it.cgstAmount +
                it.sgstAmount +
                it.igstAmount;
              return (
                <tr key={it.id} className="align-top">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2">{it.description}</td>
                  <td className="py-2 text-muted-foreground">{it.sacCode}</td>
                  <td className="py-2 text-right tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatINR(it.unitPrice)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatINR(it.taxableValue)}
                  </td>
                  {isIntraState ? (
                    <>
                      <td className="py-2 text-right tabular-nums">
                        {formatINR(it.cgstAmount)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatINR(it.sgstAmount)}
                      </td>
                    </>
                  ) : invoice.taxRatePct > 0 ? (
                    <td className="py-2 text-right tabular-nums">
                      {formatINR(it.igstAmount)}
                    </td>
                  ) : null}
                  <td className="py-2 text-right tabular-nums font-medium text-navy">
                    {formatINR(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t border-line/70 bg-ivory/30 px-6 py-5 flex flex-col gap-1.5 items-end">
        <TotalRow label="Subtotal (taxable)" value={invoice.subtotal} />
        {invoice.cgstAmount > 0 ? (
          <TotalRow
            label={`CGST (${invoice.taxRatePct / 2}%)`}
            value={invoice.cgstAmount}
          />
        ) : null}
        {invoice.sgstAmount > 0 ? (
          <TotalRow
            label={`SGST (${invoice.taxRatePct / 2}%)`}
            value={invoice.sgstAmount}
          />
        ) : null}
        {invoice.igstAmount > 0 ? (
          <TotalRow
            label={`IGST (${invoice.taxRatePct}%)`}
            value={invoice.igstAmount}
          />
        ) : null}
        {invoice.roundOff !== 0 ? (
          <TotalRow label="Round off" value={invoice.roundOff} muted />
        ) : null}
        <div className="mt-2 flex items-center gap-3 border-t border-line pt-2 min-w-[220px] justify-end">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Grand total
          </span>
          <span className="font-display text-2xl text-navy tabular-nums">
            {formatINR(invoice.grandTotal)}
          </span>
        </div>
        {invoice.amountInWords ? (
          <p className="text-[11px] text-muted-foreground italic mt-1 text-right max-w-md">
            {invoice.amountInWords}
          </p>
        ) : null}
      </div>

      {/* Bank + signatory + terms */}
      <footer className="border-t border-line/70 px-6 py-5 grid gap-5 md:grid-cols-2">
        {supplier?.bank?.accountNumber ? (
          <div className="text-xs space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
              Bank details
            </p>
            <p className="text-navy">{supplier.bank.holder ?? "—"}</p>
            <p className="text-ink/80">
              {supplier.bank.name} · A/c {supplier.bank.accountNumber}
            </p>
            <p className="text-ink/80">IFSC: {supplier.bank.ifsc ?? "—"}</p>
          </div>
        ) : (
          <div />
        )}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            For {supplier?.legalName ?? "—"}
          </p>
          <div className="h-12" />
          <p className="text-sm font-medium text-navy">
            {supplier?.signatory?.name ?? "Authorised signatory"}
          </p>
          {supplier?.signatory?.designation ? (
            <p className="text-[11px] text-muted-foreground">
              {supplier.signatory.designation}
            </p>
          ) : null}
        </div>
      </footer>

      {(supplier?.invoiceTerms || supplier?.invoiceNotes) && (
        <div className="border-t border-line/70 bg-ivory/30 px-6 py-4 text-xs text-muted-foreground space-y-2">
          {supplier?.invoiceTerms ? (
            <p className="whitespace-pre-wrap">
              <span className="font-medium text-navy">Terms: </span>
              {supplier.invoiceTerms}
            </p>
          ) : null}
          {supplier?.invoiceNotes ? (
            <p className="whitespace-pre-wrap">
              <span className="font-medium text-navy">Notes: </span>
              {supplier.invoiceNotes}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-1.5">
        {label}
      </p>
      <div className="space-y-0.5 text-sm">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-[10px] uppercase tracking-[0.16em]">{label}: </span>
      <span className="text-navy">{value}</span>
    </p>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}:
      </span>
      <span className="text-navy">{value ?? "—"}</span>
    </span>
  );
}

function TotalRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 min-w-[260px] justify-end text-sm">
      <span className={cn("text-muted-foreground", muted && "italic")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums w-32 text-right",
          muted ? "text-muted-foreground italic" : "text-navy"
        )}
      >
        {formatINR(value)}
      </span>
    </div>
  );
}
