import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Receipt,
  Calendar,
  Building2,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { VendorFormDialog } from "@/components/vendors/vendor-form-dialog";
import { VendorNotesForm } from "@/components/vendors/vendor-notes-form";
import { VendorPaymentDialog } from "@/components/vendors/vendor-payment-dialog";
import { VendorPaymentRowActions } from "@/components/vendors/vendor-payment-row-actions";
import { VendorStatTile } from "@/components/vendors/vendor-stat-tile";
import { getVendorById } from "@/server/services/vendors";
import {
  VENDOR_TYPE_LABEL,
  VENDOR_ASSIGNMENT_STATUS_LABEL,
  VENDOR_ASSIGNMENT_STATUS_TONE,
  VENDOR_PAYMENT_MODE_LABEL,
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
  vendorContactLine,
} from "@/lib/crm";
import { formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vendor = await getVendorById(params.id);
  if (!vendor) notFound();

  const totalCommitted = vendor.assignments
    .filter((a) => a.status !== "CANCELLED")
    .reduce((s, a) => s + (a.totalCost ?? 0), 0);
  const totalPaid = vendor.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, totalCommitted - totalPaid);
  const upcoming = vendor.assignments.filter(
    (a) =>
      a.status !== "CANCELLED" &&
      a.status !== "COMPLETED" &&
      a.startDate &&
      a.startDate >= new Date()
  );

  const location = vendorContactLine(vendor);

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/vendors"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All vendors
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 mb-10">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-4xl md:text-5xl text-ink leading-tight">
              {vendor.name}
            </h1>
            {vendor.isPreferred ? (
              <Badge variant="accent">
                <Star className="h-3 w-3 fill-gold-deep text-gold-deep" />
                Preferred
              </Badge>
            ) : null}
            {!vendor.isActive ? (
              <Badge variant="danger">Archived</Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
            <Building2 className="h-3 w-3" />
            <span>{VENDOR_TYPE_LABEL[vendor.type]}</span>
            {location ? (
              <>
                <span>·</span>
                <MapPin className="h-3 w-3" />
                <span>{location}</span>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {vendor.phone ? (
              <a
                href={`tel:${vendor.phone}`}
                className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-xs text-ink hover:border-[var(--gold-line)]"
              >
                <Phone className="h-3 w-3" />
                {vendor.phone}
              </a>
            ) : null}
            {vendor.whatsapp ? (
              <a
                href={`https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-xs text-ok hover:border-ok/40"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
            ) : null}
            {vendor.email ? (
              <a
                href={`mailto:${vendor.email}`}
                className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-paper px-2.5 py-1 text-xs text-ink hover:border-[var(--gold-line)]"
              >
                <Mail className="h-3 w-3" />
                {vendor.email}
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <VendorFormDialog
            mode="edit"
            vendor={{
              id: vendor.id,
              name: vendor.name,
              type: vendor.type,
              phone: vendor.phone,
              whatsapp: vendor.whatsapp,
              email: vendor.email,
              address: vendor.address,
              city: vendor.city,
              state: vendor.state,
              country: vendor.country,
              gstNumber: vendor.gstNumber,
              paymentTerms: vendor.paymentTerms,
              notes: vendor.notes,
              isPreferred: vendor.isPreferred,
              isActive: vendor.isActive,
            }}
          />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <VendorStatTile
          label="Assignments"
          value={vendor.assignments.length}
          hint={`${upcoming.length} upcoming`}
        />
        <VendorStatTile
          label="Committed"
          value={formatINR(totalCommitted)}
          tone="accent"
        />
        <VendorStatTile
          label="Paid"
          value={formatINR(totalPaid)}
          tone="success"
        />
        <VendorStatTile
          label="Outstanding"
          value={formatINR(outstanding)}
          tone={outstanding > 0 ? "danger" : "default"}
        />
      </section>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          {vendor.assignments.length === 0 ? (
            <EmptyPanel
              title="No assignments yet"
              body="Assign this vendor from a trip's Operations tab."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-paper shadow-soft">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-paper-2 text-[10px] uppercase tracking-[0.2em] text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Service</th>
                    <th className="px-4 py-3 text-left">Trip</th>
                    <th className="px-4 py-3 text-left">Dates</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {vendor.assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-paper-2">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{a.title}</div>
                        {a.confirmationNumber ? (
                          <div className="text-[11px] text-muted">
                            Conf #{a.confirmationNumber}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/trips/${a.trip.id}`}
                          className="text-ink hover:text-gold-deep"
                        >
                          {a.trip.destination}
                        </Link>
                        <div className="mt-0.5">
                          <Badge variant={TRIP_STATUS_TONE[a.trip.status]}>
                            {TRIP_STATUS_LABEL[a.trip.status]}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {a.startDate ? formatDate(a.startDate) : "—"}
                        {a.endDate
                          ? ` → ${formatDate(a.endDate)}`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {a.totalCost ? formatINR(a.totalCost) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={VENDOR_ASSIGNMENT_STATUS_TONE[a.status]}
                        >
                          {VENDOR_ASSIGNMENT_STATUS_LABEL[a.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted">
              Pay-outs made to {vendor.name}.
            </p>
            <VendorPaymentDialog
              vendorId={vendor.id}
              vendorName={vendor.name}
              trips={Array.from(
                new Map(
                  vendor.assignments.map((a) => [
                    a.trip.id,
                    {
                      id: a.trip.id,
                      label: `${a.trip.destination} · ${a.trip.days}d`,
                    },
                  ])
                ).values()
              )}
            />
          </div>
          {vendor.payments.length === 0 ? (
            <EmptyPanel
              title="No payments recorded"
              body="Vendor payments you record will appear here."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-paper shadow-soft">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-paper-2 text-[10px] uppercase tracking-[0.2em] text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Calendar className="inline h-3 w-3 mr-1" />
                      Date
                    </th>
                    <th className="px-4 py-3 text-left">Mode</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-right">
                      <Receipt className="inline h-3 w-3 mr-1" />
                      Amount
                    </th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {vendor.payments.map((p) => (
                    <tr key={p.id} className="group hover:bg-paper-2">
                      <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                      <td className="px-4 py-3">
                        {VENDOR_PAYMENT_MODE_LABEL[p.mode]}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {p.reference ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        {formatINR(p.amount)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <VendorPaymentRowActions
                          paymentId={p.id}
                          amount={p.amount}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-line bg-paper p-6 shadow-soft space-y-3 text-sm">
              <h3 className="font-display text-xl text-ink">Profile</h3>
              <Field label="Address" value={vendor.address} />
              <Field
                label="Location"
                value={location || null}
              />
              <Field label="GSTIN" value={vendor.gstNumber} />
              <Field label="Payment terms" value={vendor.paymentTerms} />
            </div>

            <div className="rounded-lg border border-line bg-paper p-6 shadow-soft space-y-3 text-sm">
              <h3 className="font-display text-xl text-ink">Operational notes</h3>
              {vendor.notes ? (
                <p className="whitespace-pre-wrap text-muted">
                  {vendor.notes}
                </p>
              ) : (
                <p className="text-muted italic">
                  No notes yet — use the form below to capture context.
                </p>
              )}
              <div className="pt-2 border-t border-line/70">
                <VendorNotesForm vendorId={vendor.id} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity">
          {vendor.activities.length === 0 ? (
            <EmptyPanel
              title="No activity yet"
              body="Vendor events (assignments, vouchers, payments) will appear here."
            />
          ) : (
            <ol className="space-y-3">
              {vendor.activities.map((a) => (
                <li
                  key={a.id}
                  className="rounded-[10px] border border-line bg-paper p-4 shadow-soft"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink text-sm">{a.title}</p>
                    <span className="text-[11px] text-muted">
                      {formatDate(a.createdAt)}
                    </span>
                  </div>
                  {a.body ? (
                    <p className="mt-1 text-xs text-muted whitespace-pre-wrap">
                      {a.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-ink">
        {value ?? <span className="text-muted italic">—</span>}
      </p>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper-2 p-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
