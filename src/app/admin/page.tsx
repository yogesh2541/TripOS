import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AdminAgenciesTable } from "@/components/admin/agencies-table";
import { getPlatformAdmin } from "@/lib/platform-admin";
import {
  getPlatformStats,
  listAgenciesForAdmin,
} from "@/server/services/platform";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  // Hidden unless you're a platform admin — 404 rather than 403 so the route's
  // existence isn't even confirmed to non-admins.
  const admin = await getPlatformAdmin();
  if (!admin) notFound();

  const [stats, agencies] = await Promise.all([
    getPlatformStats(),
    listAgenciesForAdmin(searchParams.q),
  ]);

  return (
    <PageShell>
      <header className="mb-7">
        <p className="tc-eyebrow gold">
          <ShieldCheck className="h-[13px] w-[13px]" />
          Owner console
        </p>
        <h1 className="tc-page-title mt-2.5">Platform</h1>
        <p className="tc-page-sub">
          Every agency on TripCraft — subscriptions, usage and controls. Visible
          only to platform admins.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <Stat label="Agencies" value={String(stats.agencies)} />
        <Stat label="Paying" value={String(stats.paying)} tone="sage" />
        <Stat label="On trial" value={String(stats.trialing)} />
        <Stat label="Users" value={String(stats.users)} />
        <Stat
          label="MRR"
          value={formatINR(stats.mrr)}
          tone="navy"
        />
      </section>

      <AdminAgenciesTable
        agencies={agencies.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          trialEndsAt: a.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: a.currentPeriodEnd?.toISOString() ?? null,
        }))}
        query={searchParams.q ?? ""}
      />
    </PageShell>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "sage" | "navy";
}) {
  return (
    <div className="tc-stat">
      <div className="tc-stat-label">{label}</div>
      <div
        className="tc-stat-val tnum mt-1"
        style={
          tone === "sage"
            ? { color: "var(--ok)" }
            : tone === "navy"
              ? { color: "var(--gold-deep)" }
              : undefined
        }
      >
        {value}
      </div>
    </div>
  );
}
