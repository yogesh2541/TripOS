import { notFound } from "next/navigation";
import {
  Calendar,
  Phone,
  MapPin,
  Mail,
  MessageCircle,
  Hash,
  Building2,
  Download,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVoucherByToken } from "@/server/services/vouchers";
import type { VoucherSnapshot } from "@/server/services/vouchers";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  HOTEL: "Hotel voucher",
  TRANSFER: "Transfer voucher",
  SIGHTSEEING: "Sightseeing voucher",
  ACTIVITY: "Activity voucher",
  GUIDE: "Guide voucher",
  FLIGHT: "Flight voucher",
  TRAIN: "Train voucher",
  OTHER: "Service voucher",
};

export default async function PublicVoucherPage({
  params,
}: {
  params: { token: string };
}) {
  const voucher = await getVoucherByToken(params.token);
  if (!voucher) notFound();

  const s = voucher.content as unknown as VoucherSnapshot;

  return (
    <div className="min-h-screen bg-ivory text-ink">
      {/* Hero */}
      <header className="bg-navy text-ivory">
        <div className="container max-w-2xl px-5 py-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sand" />
              <span className="font-display tracking-widest text-sm">
                {s.agency.name.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-sand-200/80">
              Crafted travel · Voucher of service
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-sand-200/80">
              Voucher
            </p>
            <p className="font-display tracking-wider mt-0.5">
              {s.voucherNumber}
            </p>
            <p className="text-[10px] mt-1 text-sand-200/70">
              Issued {formatDate(s.generatedAt)}
            </p>
          </div>
        </div>
        <div className="h-1 bg-sand" />
      </header>

      <main className="container max-w-2xl px-5 py-8 space-y-6">
        {/* Subject */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-700">
            {CATEGORY_LABEL[s.service.category] ?? CATEGORY_LABEL.OTHER}
          </p>
          <h1 className="mt-2 font-display text-3xl text-navy leading-tight">
            {s.service.title}
          </h1>
          {s.service.confirmationNumber ? (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sand-100 border border-sand-200 px-3 py-1.5">
              <Hash className="h-3.5 w-3.5 text-sand-800" />
              <span className="text-sm font-medium tracking-wider text-sand-800">
                {s.service.confirmationNumber}
              </span>
            </div>
          ) : null}
        </section>

        {/* Download CTA */}
        <a
          href={`/api/vouchers/${voucher.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <Button className="w-full">
            <Download className="h-4 w-4" />
            Download PDF voucher
          </Button>
        </a>

        {/* Service details */}
        <Card>
          <SectionLabel>Service details</SectionLabel>
          <Field label="Dates" strong>
            {s.service.startDate ? (
              <>
                {formatDate(s.service.startDate)}
                {s.service.endDate
                  ? ` → ${formatDate(s.service.endDate)}`
                  : ""}
              </>
            ) : (
              "—"
            )}
          </Field>
          {s.service.quantity ? (
            <Field label="Quantity">{s.service.quantity}</Field>
          ) : null}
          {s.service.description ? (
            <Field label="Includes">{s.service.description}</Field>
          ) : null}
        </Card>

        {/* Vendor */}
        <Card>
          <SectionLabel>Vendor</SectionLabel>
          <h3 className="font-display text-xl text-navy">{s.vendor.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            {s.vendor.type}
          </p>

          {s.vendor.address ? (
            <p className="mt-3 text-sm flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                {s.vendor.address}
                {[s.vendor.city, s.vendor.state, s.vendor.country]
                  .filter(Boolean)
                  .join(", ") ? (
                  <>
                    <br />
                    <span className="text-muted-foreground">
                      {[s.vendor.city, s.vendor.state, s.vendor.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </>
                ) : null}
              </span>
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {s.vendor.phone ? (
              <a
                href={`tel:${s.vendor.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-navy hover:border-sand-200"
              >
                <Phone className="h-3 w-3" />
                {s.vendor.phone}
              </a>
            ) : null}
            {s.vendor.whatsapp ? (
              <a
                href={`https://wa.me/${s.vendor.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-emerald-700 hover:border-emerald-200"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
            ) : null}
            {s.vendor.email ? (
              <a
                href={`mailto:${s.vendor.email}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-navy hover:border-sand-200"
              >
                <Mail className="h-3 w-3" />
                {s.vendor.email}
              </a>
            ) : null}
          </div>
        </Card>

        {/* Trip + traveler */}
        <Card>
          <SectionLabel>Trip</SectionLabel>
          <Field label="Destination">{s.trip.destination}</Field>
          <Field label="Duration">
            {s.trip.days} {s.trip.days === 1 ? "day" : "days"}
          </Field>
          {s.traveler.leadName ? (
            <Field label="Lead traveler">{s.traveler.leadName}</Field>
          ) : null}
          {s.trip.startDate ? (
            <Field label="Departs">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(s.trip.startDate)}
              </span>
            </Field>
          ) : null}
        </Card>

        {/* Emergency */}
        <div className="rounded-2xl bg-navy text-ivory p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-sand-200/80 inline-flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                24×7 Emergency
              </p>
              <p className="font-display text-xl mt-1">
                {s.agency.emergencyPhone}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-sand-200/80">
                Concierge
              </p>
              <p className="text-sm mt-1">{s.agency.email}</p>
            </div>
          </div>
        </div>

        <footer className="text-center text-[11px] text-muted-foreground pt-4">
          {s.agency.name} · {s.agency.phone}
          <br />
          Voucher {s.voucherNumber} · Issued {formatDate(s.generatedAt)}
          {voucher.sentAt ? ` · Shared ${formatDate(voucher.sentAt)}` : null}
        </footer>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      {children}
    </section>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-3">
      {children}
    </p>
  );
}
function Field({
  label,
  children,
  strong = false,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex gap-3 py-2 border-b border-line/70 last:border-b-0">
      <span className="w-24 text-[10px] uppercase tracking-[0.18em] text-muted-foreground pt-0.5">
        {label}
      </span>
      <span
        className={
          strong
            ? "flex-1 font-medium text-navy"
            : "flex-1 text-ink"
        }
      >
        {children}
      </span>
    </div>
  );
}
