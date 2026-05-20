import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { InvoiceEditPanel } from "@/components/invoices/invoice-edit-panel";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { getInvoiceById } from "@/server/services/invoices";
import { previewNextInvoiceNumber } from "@/server/services/invoice-numbering";
import { getAgencySettings } from "@/server/services/agency-settings";
import { formatDate } from "@/lib/utils";

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
      invoice.userId,
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
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Tax invoice
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl text-navy leading-tight">
            {invoice.invoiceNumber ?? "Draft"}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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
                    className="text-navy hover:underline"
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
          recipientPhone={invoice.booking?.trip?.lead?.phone ?? null}
        />
      </header>

      {!settings ? (
        <div className="mb-6 rounded-2xl border border-sand-200 bg-sand-50/40 p-4 text-sm text-sand-800 inline-flex items-start gap-3">
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
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Cancelled {formatDate(invoice.cancelledAt!)}</p>
          {invoice.cancelReason ? (
            <p className="mt-1 text-red-700/90 whitespace-pre-wrap">
              {invoice.cancelReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1.4fr)] items-start">
        {invoice.status === "DRAFT" && settings ? (
          <InvoiceEditPanel
            invoice={invoice}
            defaultSacCode={settings.defaultSacCode}
          />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft text-sm text-muted-foreground">
            <p className="font-medium text-navy mb-1">
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
