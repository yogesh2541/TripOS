import Link from "next/link";
import {
  BarChart3,
  Filter,
  IndianRupee,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAgency } from "@/lib/session";
import {
  getAnalytics,
  parseRange,
  RANGE_LABEL,
  type AnalyticsRange,
  type Funnel,
} from "@/server/services/analytics";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL } from "@/lib/crm";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES: AnalyticsRange[] = ["30d", "90d", "365d", "all"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { range?: string };
}) {
  const { agencyId } = await requireAgency();
  const range = parseRange(searchParams.range);
  const a = await getAnalytics(agencyId, range);

  const isEmpty = a.funnel.total === 0 && a.revenue.bookingCount === 0;

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Insights
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            How your pipeline converts, what it earns, and who's driving it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Filter className="h-3 w-3" />
            Period
          </span>
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <Link
                key={r}
                href={`/reports?range=${r}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-navy bg-navy text-ivory"
                    : "border-line bg-white text-muted-foreground hover:border-navy/40 hover:text-navy"
                }`}
              >
                {RANGE_LABEL[r]}
              </Link>
            );
          })}
        </div>
      </header>

      {isEmpty ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="No data for this period"
          body="Once you start logging leads and confirming bookings, this page fills with your conversion funnel, revenue trend and agent performance."
          variant="card"
        />
      ) : (
        <div className="space-y-10">
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<IndianRupee className="h-4 w-4" />}
              label="Booked revenue"
              value={formatINR(a.revenue.booked)}
              sub={`${a.revenue.bookingCount} booking${
                a.revenue.bookingCount === 1 ? "" : "s"
              }`}
            />
            <Kpi
              icon={<Wallet className="h-4 w-4" />}
              label="Collected"
              value={formatINR(a.revenue.collected)}
              sub={`${formatINR(a.revenue.outstanding)} outstanding`}
            />
            <Kpi
              icon={<TrendingUp className="h-4 w-4" />}
              label="Gross profit"
              value={formatINR(a.revenue.grossProfit)}
              sub={`${a.revenue.marginPct}% blended margin`}
            />
            <Kpi
              icon={<Users className="h-4 w-4" />}
              label="Win rate"
              value={`${a.funnel.winRate}%`}
              sub={`${a.funnel.won} won of ${a.funnel.total} leads`}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <FunnelCard funnel={a.funnel} />
            <RevenueTrendCard byMonth={a.revenue.byMonth} />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <SourceCard sources={a.sources} />
            <AgentCard agents={a.agents} />
          </div>

          {a.leadsByStatus.length > 0 && (
            <StatusBreakdown
              rows={a.leadsByStatus}
              total={a.funnel.total}
            />
          )}
        </div>
      )}
    </PageShell>
  );
}

// --- KPI --------------------------------------------------------------------

function Kpi({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-center gap-2 text-sand-700">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl text-navy leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// --- Card shell -------------------------------------------------------------

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex items-baseline justify-between gap-3 mb-5">
        <h2 className="font-display text-xl text-navy">{title}</h2>
        {hint && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// --- Funnel -----------------------------------------------------------------

function FunnelCard({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: "Leads", count: funnel.total },
    { label: "Contacted", count: funnel.contacted },
    { label: "Quoted", count: funnel.quoted },
    { label: "Won", count: funnel.won },
  ];
  return (
    <Card title="Conversion funnel" hint={`${funnel.winRate}% win rate`}>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const width = funnel.total > 0 ? (s.count / funnel.total) * 100 : 0;
          const dropFromPrev =
            i > 0 && stages[i - 1].count > 0
              ? Math.round((s.count / stages[i - 1].count) * 100)
              : null;
          return (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-sm mb-1">
                <span className="text-ink">{s.label}</span>
                <span className="tabular-nums text-navy font-medium">
                  {s.count}
                  {dropFromPrev !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {dropFromPrev}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-7 rounded-lg bg-ivory border border-line/60 overflow-hidden">
                <div
                  className="h-full rounded-lg bg-navy"
                  style={{ width: `${Math.max(width, s.count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {funnel.lost > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {funnel.lost} contact{funnel.lost === 1 ? "" : "s"} marked lost in this
          period.
        </p>
      )}
    </Card>
  );
}

// --- Revenue trend ----------------------------------------------------------

function RevenueTrendCard({
  byMonth,
}: {
  byMonth: { month: string; label: string; booked: number; collected: number }[];
}) {
  const max = Math.max(1, ...byMonth.map((m) => m.booked));
  return (
    <Card title="Revenue trend" hint="Booked vs collected">
      {byMonth.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No bookings in this period.
        </p>
      ) : (
        <div className="space-y-3">
          {byMonth.map((m) => (
            <div key={m.month}>
              <div className="flex items-baseline justify-between text-xs mb-1">
                <span className="uppercase tracking-[0.14em] text-muted-foreground">
                  {m.label}
                </span>
                <span className="tabular-nums text-navy">
                  {formatINR(m.booked)}
                </span>
              </div>
              <div className="relative h-5 rounded-md bg-ivory border border-line/60 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-sand-200"
                  style={{ width: `${(m.booked / max) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-navy"
                  style={{ width: `${(m.collected / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-navy" />
              Collected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-sand-200" />
              Booked
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

// --- Source attribution -----------------------------------------------------

function SourceCard({
  sources,
}: {
  sources: {
    source: keyof typeof LEAD_SOURCE_LABEL;
    leads: number;
    won: number;
    revenue: number;
    conversion: number;
  }[];
}) {
  return (
    <Card title="Contact sources" hint="Where business comes from">
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No leads yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-line">
              <th className="pb-2 font-medium">Source</th>
              <th className="pb-2 font-medium text-right">Leads</th>
              <th className="pb-2 font-medium text-right">Won</th>
              <th className="pb-2 font-medium text-right">Conv.</th>
              <th className="pb-2 font-medium text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr
                key={s.source}
                className="border-b border-line/50 last:border-0"
              >
                <td className="py-2.5 text-navy">
                  {LEAD_SOURCE_LABEL[s.source]}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {s.leads}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {s.won}
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {s.conversion}%
                </td>
                <td className="py-2.5 text-right tabular-nums text-navy font-medium">
                  {formatINR(s.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// --- Agent performance ------------------------------------------------------

function AgentCard({
  agents,
}: {
  agents: {
    userId: string;
    name: string;
    leads: number;
    won: number;
    trips: number;
    revenue: number;
  }[];
}) {
  return (
    <Card title="Agent performance" hint="Revenue closed">
      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No assigned leads or trips yet.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-line">
              <th className="pb-2 font-medium">Agent</th>
              <th className="pb-2 font-medium text-right">Leads</th>
              <th className="pb-2 font-medium text-right">Won</th>
              <th className="pb-2 font-medium text-right">Trips</th>
              <th className="pb-2 font-medium text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((ag) => (
              <tr
                key={ag.userId}
                className="border-b border-line/50 last:border-0"
              >
                <td className="py-2.5 text-navy">{ag.name}</td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {ag.leads}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {ag.won}
                </td>
                <td className="py-2.5 text-right tabular-nums text-ink">
                  {ag.trips}
                </td>
                <td className="py-2.5 text-right tabular-nums text-navy font-medium">
                  {formatINR(ag.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// --- Status breakdown -------------------------------------------------------

function StatusBreakdown({
  rows,
  total,
}: {
  rows: { status: keyof typeof LEAD_STATUS_LABEL; count: number }[];
  total: number;
}) {
  return (
    <Card title="Pipeline by status" hint={`${total} leads`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.status}
            className="rounded-xl border border-line/60 bg-ivory px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {LEAD_STATUS_LABEL[r.status]}
            </p>
            <p className="mt-1 font-display text-2xl text-navy tabular-nums">
              {r.count}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
