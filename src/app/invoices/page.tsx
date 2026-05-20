import Link from "next/link";
import { ArrowUpRight, FileText, Plus } from "lucide-react";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FyFilter } from "@/components/invoices/fy-filter";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";
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
  searchParams: { status?: string; fy?: string };
}) {
  const user = await getOrCreateDemoUser();
  const filter = (searchParams.status ?? "all").toLowerCase();
  const selected = FILTERS.find((f) => f.key === filter);

  const where: Prisma.InvoiceWhereInput = { userId: user.id };
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
                lead: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.invoice.aggregate({
      where: { userId: user.id, status: "ISSUED" },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["invoiceFy"],
      where: { userId: user.id, invoiceFy: { not: null } },
      orderBy: { invoiceFy: "desc" },
    }),
  ]);

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Billing
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totals._count} issued ·{" "}
            <span className="font-medium text-navy">
              {formatINR(totals._sum.grandTotal ?? 0)}
            </span>{" "}
            lifetime billed
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {FILTERS.map((f) => {
          const href = f.key === "all" ? "/invoices" : `/invoices?status=${f.key}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={cn(
                "h-9 px-4 rounded-full border text-xs uppercase tracking-[0.16em] transition-colors",
                f.key === filter
                  ? "border-navy bg-navy text-ivory"
                  : "border-line bg-white text-navy hover:border-sand"
              )}
            >
              {f.label}
            </Link>
          );
        })}
        {fyOptions.length > 0 ? (
          <FyFilter
            options={fyOptions
              .map((o) => o.invoiceFy)
              .filter((fy): fy is string => Boolean(fy))}
          />
        ) : null}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No invoices yet"
          body="Invoices generate from booked trips. Open any booking and tap 'Generate tax invoice' to draft your first one."
          action={
            <Link href="/bookings">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-navy text-ivory px-6 py-2.5 text-sm font-medium shadow-soft hover:bg-navy-600">
                <Plus className="h-4 w-4" />
                Open bookings
              </button>
            </Link>
          }
          variant="card"
        />
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-6 rounded-2xl border border-line bg-white px-5 py-4 hover:shadow-soft transition-all group"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg text-navy leading-tight">
                    {inv.invoiceNumber ?? (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {inv.booking?.trip?.destination ?? "—"}
                    {inv.booking?.trip?.lead
                      ? ` · ${inv.booking.trip.lead.name}`
                      : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {inv.status === "ISSUED"
                      ? "Issued"
                      : inv.status === "CANCELLED"
                        ? "Cancelled"
                        : "Drafted"}
                  </p>
                  <p className="text-sm text-navy mt-0.5">
                    {inv.status === "ISSUED"
                      ? formatDate(inv.issuedAt!)
                      : inv.status === "CANCELLED"
                        ? formatDate(inv.cancelledAt!)
                        : formatDate(inv.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-navy tabular-nums">
                    {formatINR(inv.grandTotal)}
                  </p>
                  {inv.invoiceFy ? (
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                      FY {inv.invoiceFy}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={TONE[inv.status]}>{inv.status}</Badge>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-navy transition-colors" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
