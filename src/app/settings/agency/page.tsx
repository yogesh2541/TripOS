import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AgencySettingsForm } from "@/components/settings/agency-settings-form";
import { OneTimeHint } from "@/components/ui/one-time-hint";
import { getAgencySettings } from "@/server/services/agency-settings";

export const dynamic = "force-dynamic";

export default async function AgencySettingsPage() {
  const existing = await getAgencySettings();

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <header className="mb-8">
        <p className="tc-eyebrow gold">Settings</p>
        <h1 className="tc-page-title mt-2.5">Agency</h1>
        <p className="tc-page-sub max-w-2xl">
          Your agency identity, GSTIN and invoice defaults. These details are
          frozen onto every invoice at issue time, so changes here only affect
          new invoices going forward.
        </p>
      </header>

      <OneTimeHint
        id="agency-settings-intro"
        title="GST-ready, configurable per invoice"
        variant="accent"
        className="mb-6"
      >
        Pick your default GST scheme (5% without ITC is the most common for
        tour operator services). You'll be able to override the scheme, basis
        and place of supply on each invoice individually.
      </OneTimeHint>

      {!existing ? (
        <div className="mb-6 rounded-lg border border-[var(--gold-line)] bg-gold-soft/40 p-4 text-sm text-gold-deep inline-flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">No settings on file yet.</span>{" "}
            Fill in the legal name + GSTIN below to unlock invoice generation
            on bookings.
          </span>
        </div>
      ) : null}

      <AgencySettingsForm
        initial={
          existing
            ? {
                legalName: existing.legalName,
                tradeName: existing.tradeName,
                gstin: existing.gstin,
                pan: existing.pan,
                logoUrl: existing.logoUrl,
                addressLine1: existing.addressLine1,
                addressLine2: existing.addressLine2,
                city: existing.city,
                state: existing.state,
                stateCode: existing.stateCode,
                pincode: existing.pincode,
                country: existing.country,
                phone: existing.phone,
                email: existing.email,
                website: existing.website,
                authorizedSignatory: existing.authorizedSignatory,
                signatoryDesignation: existing.signatoryDesignation,
                invoicePrefix: existing.invoicePrefix,
                defaultTaxScheme: existing.defaultTaxScheme,
                defaultTaxableBasis: existing.defaultTaxableBasis,
                defaultSacCode: existing.defaultSacCode,
                defaultPlaceOfSupplyState: existing.defaultPlaceOfSupplyState,
                defaultPlaceOfSupplyStateCode:
                  existing.defaultPlaceOfSupplyStateCode,
                bankName: existing.bankName,
                bankAccountNumber: existing.bankAccountNumber,
                bankIfscCode: existing.bankIfscCode,
                bankAccountHolder: existing.bankAccountHolder,
                invoiceTerms: existing.invoiceTerms,
                invoiceNotes: existing.invoiceNotes,
                eInvoiceEnabled: existing.eInvoiceEnabled,
                eWayBillEnabled: existing.eWayBillEnabled,
              }
            : null
        }
      />
    </PageShell>
  );
}
