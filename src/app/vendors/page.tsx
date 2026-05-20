import { Building2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { VendorFormDialog } from "@/components/vendors/vendor-form-dialog";
import { VendorList } from "@/components/vendors/vendor-list";
import { VendorStatTile } from "@/components/vendors/vendor-stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { listVendors, getVendorStats } from "@/server/services/vendors";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const [vendors, stats] = await Promise.all([
    listVendors(),
    getVendorStats(),
  ]);

  const fmtINR = (n: number) =>
    "₹ " + Math.round(n).toLocaleString("en-IN");

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Operations
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Vendors
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hotels, transport, drivers, guides — your supplier roster.
          </p>
        </div>
        <VendorFormDialog />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <VendorStatTile label="Total" value={stats.total} />
        <VendorStatTile
          label="Active"
          value={stats.active}
          tone="success"
          hint={`${stats.total - stats.active} archived`}
        />
        <VendorStatTile
          label="Preferred"
          value={stats.preferred}
          tone="accent"
        />
        <VendorStatTile
          label="Pending payments"
          value={fmtINR(stats.pendingPayments)}
          tone={stats.pendingPayments > 0 ? "danger" : "default"}
          hint="Across open assignments"
        />
      </section>

      {vendors.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="Build your supplier roster"
          body="Hotels, drivers, guides, DMCs — anyone you book on behalf of travelers. Mark your favourites preferred and they'll surface first when assigning."
          action={<VendorFormDialog />}
          hint="You can also add a vendor mid-trip from the Operations tab"
        />
      ) : (
        <VendorList vendors={vendors} />
      )}
    </PageShell>
  );
}
