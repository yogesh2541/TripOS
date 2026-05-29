import Link from "next/link";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewToggle } from "@/components/ui/view-toggle";
import { FyFilter } from "@/components/invoices/fy-filter";
import { InvoicesTable, type InvoiceRow } from "@/components/invoices/invoices-table";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; status?: InvoiceStatus }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft", status: "DRAFT" },
  { key: "issued", label: "Issued", status: "ISSUED" },
  { key: "cancelled", label: "Cancelled", status: "CANCELLED" },
];

const TONE: Record<InvoiceStatus, "outline" | "success" | "danger"> = {
  DRAFT: "outline",
  ISSUED: "success",
  CANCELLED: "danger",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { status?: string; fy?: string; view?: string };
}) {
  const { agencyId } = await requireAgency();
  const filter = (searchParams.status ?? "all").toLowerCase();
  const selected = FILTERS.find((f) => f.key === filter);
  const view = searchParams.view === "table" ? "table" : "cards";

  const where: Prisma.InvoiceWhereInput = { agencyId };
  if (selected?.status) where.status = selected.status;
  if (searchParams.fy) where.invoiceFy = searchParams.fy;

  const [invoices, totals, fyOptions] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        booking: {
          include: {
            trip: {
              select: {
                id: true,
                destination: true,
                contact: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.invoice.aggregate({
      where: { agencyId, status: "ISSUED" },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["invoiceFy"],
      where: { agencyId, invoiceFy: { not: null } },
      orderBy: { invoiceFy: "desc" },
    }),
  ]);

  const tableRows: InvoiceRow[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    destination: inv.booking?.trip?.destination ?? null,
    customerName: inv.booking?.trip?.contact?.name ?? null,
    invoiceFy: inv.invoiceFy,
    grandTotal: inv.grandTotal,
    effectiveDate:
      inv.status === "ISSUED" && inv.issuedAt
        ? inv.issuedAt
        : inv.status === "CANCELLED" && inv.cancelledAt
          ? inv.cancelledAt
          : inv.createdAt,
  }));

  // Preserve status + fy + view across filter navigation.
  const filterHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("status", key);
    if (searchParams.fy) p.set("fy", searchParams.fy);
    if (view === "table") p.set("view", "table");
    const qs = p.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">
            <FileText className="h-[13px] w-[13px]" />
            Pipeline · Finance
          </p>
          <h1 className="tc-page-title mt-2.5">Invoices &amp; bookings</h1>
          <p className="tc-page-sub">
            {totals._count} issued ·{" "}
            <span className="font-mono font-medium text-ink">
              {formatINR(totals._sum.grandTotal ?? 0)}
            </span>{" "}
            lifetime billed
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-7">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
            className={cn("tc-chip", f.key === filter && "on")}
          >
            {f.label}
          </Link>
        ))}
        {fyOptions.length > 0 ? (
          <FyFilter
            options={fyOptions
              .map((o) => o.invoiceFy)
              .filter((fy): fy is string => Boolean(fy))}
          />
        ) : null}
        {invoices.length > 0 ? (
          <div className="ml-auto">
            <ViewToggle
              defaultValue="cards"
              options={[
                { value: "cards", label: "Cards", icon: "grid" },
                { value: "table", label: "Table", icon: "table" },
              ]}
            />
          </div>
        ) : null}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No invoices yet"
          body="Invoices generate from booked trips. Open any booking and tap 'Generate tax invoice' to draft your first one."
          action={
            <Link href="/bookings">
              <button className="tc-btn tc-btn-primary">
                <Plus className="h-4 w-4" />
                Open bookings
              </button>
            </Link>
          }
          variant="card"
        />
      ) : view === "table" ? (
        <InvoicesTable invoices={tableRows} />
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="group grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-6 rounded-lg border border-line bg-paper px-5 py-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-[var(--gold-line)] hover:shadow-lift"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-ink leading-tight">
                    {inv.invoiceNumber ?? (
                      <span className="text-muted">Draft</span>
                    )}
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {inv.booking?.trip?.destination ?? "—"}
                    {inv.booking?.trip?.contact
                      ? ` · ${inv.booking.trip.contact.name}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="tc-stat-label">
                    {inv.status === "ISSUED"
                      ? "Issued"
                      : inv.status === "CANCELLED"
                        ? "Cancelled"
                        : "Drafted"}
                  </p>
                  <p className="text-sm text-ink mt-0.5">
                    {inv.status === "ISSUED"
                      ? formatDate(inv.issuedAt!)
                      : inv.status === "CANCELLED"
                        ? formatDate(inv.cancelledAt!)
                        : formatDate(inv.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-ink tabular-nums">
                    {formatINR(inv.grandTotal)}
                  </p>
                  {inv.invoiceFy ? (
                    <p className="text-[10px] uppercase tracking-[0.18em] text-faint mt-0.5">
                      FY {inv.invoiceFy}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={TONE[inv.status]}>{inv.status}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-gold-deep transition-colors" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
