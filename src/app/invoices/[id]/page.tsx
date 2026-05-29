import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, Lock } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceEditPanel } from "@/components/invoices/invoice-edit-panel";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { getInvoiceById } from "@/server/services/invoices";
import { previewNextInvoiceNumber } from "@/server/services/invoice-numbering";
import { getAgencySettings } from "@/server/services/agency-settings";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const invoice = await getInvoiceById(params.id);
  if (!invoice) notFound();

  const settings = await getAgencySettings();

  // For DRAFT, compute the would-be next number so the issue dialog shows it
  let previewedNumber: string | null = null;
  if (invoice.status === "DRAFT" && settings) {
    previewedNumber = await previewNextInvoiceNumber(
      invoice.agencyId,
      settings.invoicePrefix,
      new Date()
    );
  }

  const tone =
    invoice.status === "ISSUED"
      ? "success"
      : invoice.status === "CANCELLED"
        ? "danger"
        : "outline";

  // Operator-only margin view — the "without markup" figures. The client
  // invoice bills the selling price (markup baked into each line, never
  // itemized); here the operator sees cost basis vs that selling price.
  const costTotal = invoice.items.reduce(
    (s, it) => s + (it.cost ?? 0) * it.quantity,
    0
  );
  const sellingExTax = invoice.items.reduce(
    (s, it) => s + it.unitPrice * it.quantity,
    0
  );
  const margin = sellingExTax - costTotal;
  const marginPct = sellingExTax > 0 ? (margin / sellingExTax) * 100 : 0;
  const hasCost = costTotal > 0;

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href={
            invoice.booking?.trip?.id
              ? `/trips/${invoice.booking.trip.id}`
              : "/trips"
          }
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {invoice.booking?.trip?.id
            ? `Back to ${invoice.booking.trip.destination}`
            : "All trips"}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 mb-6">
        <div>
          <p className="tc-eyebrow gold">Tax invoice</p>
          <h1 className="mt-2 font-mono text-3xl md:text-4xl text-ink leading-tight tabular-nums font-semibold tracking-tight">
            {invoice.invoiceNumber ?? "Draft"}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Badge variant={tone}>{invoice.status}</Badge>
            <span>·</span>
            <span>
              {invoice.invoiceFy ? `FY ${invoice.invoiceFy}` : "Not yet issued"}
            </span>
            {invoice.booking?.trip ? (
              <>
                <span>·</span>
                <span>
                  Trip:{" "}
                  <Link
                    href={`/trips/${invoice.booking.trip.id}`}
                    className="text-ink hover:underline"
                  >
                    {invoice.booking.trip.destination}
                  </Link>
                </span>
              </>
            ) : null}
          </div>
        </div>

        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          previewedNumber={previewedNumber}
          recipientPhone={invoice.booking?.trip?.contact?.phone ?? null}
        />
      </header>

      {!settings ? (
        <div className="mb-6 rounded-lg border border-[var(--gold-line)] bg-gold-soft/50 p-4 text-sm text-gold-deep inline-flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Agency settings are missing — open{" "}
            <Link href="/settings/agency" className="underline font-medium">
              Settings → Agency
            </Link>{" "}
            and add your GSTIN before issuing.
          </span>
        </div>
      ) : null}

      {invoice.status === "CANCELLED" ? (
        <div className="mb-6 rounded-lg border border-bad/30 bg-bad-soft p-4 text-sm text-[#9a4234]">
          <p className="font-medium">Cancelled {formatDate(invoice.cancelledAt!)}</p>
          {invoice.cancelReason ? (
            <p className="mt-1 text-bad whitespace-pre-wrap">
              {invoice.cancelReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {hasCost ? (
        <div className="mb-6 rounded-lg border border-line bg-paper-2 p-4">
          <p className="mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted">
            <Lock className="h-3 w-3" />
            Operator only · not shown on the client invoice
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Cost basis
              </p>
              <p className="mt-1 font-mono tabular-nums text-ink">
                {formatINR(costTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Client price (ex-tax)
              </p>
              <p className="mt-1 font-mono tabular-nums text-ink">
                {formatINR(sellingExTax)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Margin
              </p>
              <p className="mt-1 font-mono tabular-nums font-semibold text-gold-deep">
                {formatINR(margin)} · {marginPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1.4fr)] items-start">
        {invoice.status === "DRAFT" && settings ? (
          <InvoiceEditPanel
            invoice={invoice}
            defaultSacCode={settings.defaultSacCode}
          />
        ) : (
          <div className="rounded-lg border border-line bg-paper p-5 shadow-soft text-sm text-muted">
            <p className="font-medium text-ink mb-1">
              {invoice.status === "ISSUED" ? "Issued" : "Cancelled"}
            </p>
            <p>
              {invoice.status === "ISSUED"
                ? "This invoice is locked. To make changes, cancel it and generate a new draft."
                : "This invoice was cancelled. Generate a fresh draft from the booking if needed."}
            </p>
          </div>
        )}

        <InvoicePreview invoice={invoice} />
      </div>
    </PageShell>
  );
}
