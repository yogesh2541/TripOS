import Link from "next/link";
import {
  BarChart3,
  Filter,
  IndianRupee,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AreaLine, Bars, Donut, Sparkline } from "@/components/charts";
import { requireAgency } from "@/lib/session";
import { getEffectivePlan } from "@/server/services/subscription";
import {
  getAnalytics,
  parseRange,
  RANGE_LABEL,
  type AnalyticsRange,
  type AgentRow,
  type Funnel,
  type RevenueBlock,
  type SourceRow,
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

  // Reports is a Pro feature — gate it before doing the analytics work.
  const plan = await getEffectivePlan(agencyId);
  if (!plan.features.reports) {
    return (
      <PageShell>
        <header className="mb-8">
          <p className="tc-eyebrow gold">
            <BarChart3 className="h-[13px] w-[13px]" />
            Insights
          </p>
          <h1 className="tc-page-title mt-2.5">Reports</h1>
        </header>
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports is a Pro feature"
          body="Upgrade to Pro to unlock the conversion funnel, revenue trend, agent performance and source attribution dashboards."
          action={
            <Link href="/settings/billing">
              <Button>View plans</Button>
            </Link>
          }
          variant="card"
        />
      </PageShell>
    );
  }

  const range = parseRange(searchParams.range);
  const a = await getAnalytics(agencyId, range);

  const isEmpty = a.funnel.total === 0 && a.revenue.bookingCount === 0;

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">
            <BarChart3 className="h-[13px] w-[13px]" />
            Insights
          </p>
          <h1 className="tc-page-title mt-2.5">Reports</h1>
          <p className="tc-page-sub">
            How your pipeline converts, what it earns, and who's driving it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted">
            <Filter className="h-3 w-3" />
            Period
          </span>
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <Link
                key={r}
                href={`/reports?range=${r}`}
                className={`tc-chip${active ? " on" : ""}`}
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
        <div className="space-y-8">
          {/* KPI row — trend sparklines where a monthly series exists */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<IndianRupee className="h-4 w-4" />}
              label="Booked revenue"
              value={formatINR(a.revenue.booked)}
              tone="navy"
              sub={`${a.revenue.bookingCount} booking${
                a.revenue.bookingCount === 1 ? "" : "s"
              } · avg ${formatINR(a.revenue.avgTripValue)}`}
              spark={a.revenue.byMonth.map((m) => m.booked)}
            />
            <Kpi
              icon={<Wallet className="h-4 w-4" />}
              label="Collected"
              value={formatINR(a.revenue.collected)}
              tone="sage"
              sub={`${formatINR(a.revenue.outstanding)} still outstanding`}
              spark={a.revenue.byMonth.map((m) => m.collected)}
              sparkColor="var(--dv-sage)"
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
              tone="clay"
              sub={`${a.funnel.won} won of ${a.funnel.total} leads`}
            />
          </div>

          {/* Revenue trend (wide) + where business comes from (donut) */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
            <RevenueTrendCard revenue={a.revenue} />
            <SourceMixCard sources={a.sources} />
          </div>

          {/* Funnel + leaderboard */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <FunnelCard funnel={a.funnel} />
            <LeaderboardCard agents={a.agents} />
          </div>

          {/* Booked vs collected, month by month */}
          <MonthlyBarsCard byMonth={a.revenue.byMonth} />

          {/* Source detail + status breakdown */}
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <SourceCard sources={a.sources} />
            {a.leadsByStatus.length > 0 ? (
              <StatusBreakdown rows={a.leadsByStatus} total={a.funnel.total} />
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

const DV_COLORS = [
  "var(--dv-slate)",
  "var(--dv-sage)",
  "var(--gold)",
  "var(--dv-clay)",
  "var(--dv-plum)",
];

// --- KPI --------------------------------------------------------------------

function Kpi({
  icon,
  label,
  value,
  sub,
  tone = "default",
  spark,
  sparkColor = "var(--gold)",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "navy" | "sage" | "clay";
  spark?: number[];
  sparkColor?: string;
}) {
  const hasSpark = spark && spark.length > 1 && spark.some((v) => v > 0);
  return (
    <div className="tc-stat">
      <div className="tc-stat-top">
        <span className={tone === "default" ? "tc-stat-ic" : `tc-stat-ic ${tone}`}>
          {icon}
        </span>
      </div>
      <div className="tc-stat-label">{label}</div>
      <div className="tc-stat-val tnum">{value}</div>
      {hasSpark ? (
        <div className="mt-2.5">
          <Sparkline data={spark!} color={sparkColor} w={150} h={28} />
        </div>
      ) : null}
      <div className="tc-stat-foot">{sub}</div>
    </div>
  );
}

// --- Card shell -------------------------------------------------------------

function Card({
  title,
  description,
  hint,
  children,
}: {
  title: string;
  description?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tc-card h-full">
      <div className="tc-card-head">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink text-[14.5px]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>
          ) : null}
        </div>
        {hint && <span className="t-mut shrink-0">{hint}</span>}
      </div>
      <div className="p-[18px]">{children}</div>
    </section>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 rounded-[8px] bg-gold-soft/50 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gold-deep" />
      <span>{children}</span>
    </p>
  );
}

// --- Funnel -----------------------------------------------------------------

function FunnelCard({ funnel }: { funnel: Funnel }) {
  const stages = [
    { label: "Leads", count: funnel.total, color: "var(--dv-slate)" },
    { label: "Contacted", count: funnel.contacted, color: "var(--dv-sage)" },
    { label: "Quoted", count: funnel.quoted, color: "var(--gold)" },
    { label: "Won", count: funnel.won, color: "var(--inkwash)" },
  ];
  // Biggest leak — the consecutive step with the steepest fall-off.
  let leak: { from: string; to: string; keptPct: number } | null = null;
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1].count;
    if (prev <= 0) continue;
    const keptPct = Math.round((stages[i].count / prev) * 100);
    if (!leak || keptPct < leak.keptPct) {
      leak = { from: stages[i - 1].label, to: stages[i].label, keptPct };
    }
  }
  return (
    <Card
      title="Conversion funnel"
      description={`${funnel.winRate}% of leads become bookings`}
      hint={`${funnel.total} leads`}
    >
      <div className="space-y-4">
        {stages.map((s, i) => {
          const width = funnel.total > 0 ? (s.count / funnel.total) * 100 : 0;
          const dropFromPrev =
            i > 0 && stages[i - 1].count > 0
              ? Math.round((s.count / stages[i - 1].count) * 100)
              : null;
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-[13px] mb-1.5">
                <span className="flex items-center gap-2 text-ink-2">
                  <span
                    className="h-[9px] w-[9px] rounded-[3px]"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span className="font-mono tabular-nums">
                  <b className="t-strong">{s.count}</b>
                  {dropFromPrev !== null && (
                    <span className="ml-2 t-mut">· {dropFromPrev}% kept</span>
                  )}
                </span>
              </div>
              <div className="tc-meter" style={{ height: 8 }}>
                <i
                  style={{
                    width: `${Math.max(width, s.count > 0 ? 4 : 0)}%`,
                    background: s.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {leak ? (
        <Insight>
          Biggest drop-off is <b>{leak.from} → {leak.to}</b>, where only{" "}
          {leak.keptPct}% carry through.
          {funnel.lost > 0
            ? ` ${funnel.lost} marked lost this period.`
            : ""}
        </Insight>
      ) : null}
    </Card>
  );
}

// --- Revenue trend (collected, area) ----------------------------------------

function RevenueTrendCard({ revenue }: { revenue: RevenueBlock }) {
  const area = revenue.byMonth.map((m) => ({
    label: m.label,
    value: m.collected,
  }));
  const collectionRate =
    revenue.booked > 0
      ? Math.round((revenue.collected / revenue.booked) * 100)
      : 0;
  return (
    <Card
      title="Revenue collected"
      description="Cash in, month by month"
      hint={revenue.byMonth.length > 0 ? `${collectionRate}% of booked` : undefined}
    >
      {area.length === 0 ? (
        <p className="text-sm text-muted italic">No bookings in this period.</p>
      ) : (
        <div>
          <div className="flex items-end gap-3 mb-1">
            <span className="font-display text-3xl tracking-tight text-ink tabular-nums">
              {formatINR(revenue.collected)}
            </span>
            <span className="mb-1 text-[12px] text-muted">
              of {formatINR(revenue.booked)} booked
            </span>
          </div>
          <AreaLine data={area} h={190} />
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line-2 pt-3 text-center">
            <MiniStat label="Outstanding" value={formatINR(revenue.outstanding)} />
            <MiniStat label="Avg. trip" value={formatINR(revenue.avgTripValue)} />
            <MiniStat label="Margin" value={`${revenue.marginPct}%`} />
          </div>
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tc-stat-label">{label}</p>
      <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

// --- Source mix (donut) -----------------------------------------------------

function SourceMixCard({ sources }: { sources: SourceRow[] }) {
  const withLeads = [...sources]
    .filter((s) => s.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);
  const donut = withLeads.map((s, i) => ({
    label: LEAD_SOURCE_LABEL[s.source],
    value: s.leads,
    color: DV_COLORS[i % DV_COLORS.length],
  }));
  // Best converter with a meaningful sample (≥3 leads).
  const best = [...sources]
    .filter((s) => s.leads >= 3)
    .sort((a, b) => b.conversion - a.conversion)[0];
  return (
    <Card title="Where business comes from" description="Leads by channel">
      {donut.length === 0 ? (
        <p className="text-sm text-muted italic">No leads yet.</p>
      ) : (
        <>
          <Donut data={donut} size={150} centerLabel="LEADS" />
          {best ? (
            <Insight>
              <b>{LEAD_SOURCE_LABEL[best.source]}</b> converts best —{" "}
              {best.conversion}% of its leads book.
            </Insight>
          ) : null}
        </>
      )}
    </Card>
  );
}

// --- Sales leaderboard ------------------------------------------------------

function LeaderboardCard({ agents }: { agents: AgentRow[] }) {
  const ranked = [...agents]
    .filter((ag) => ag.revenue > 0 || ag.won > 0 || ag.leads > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const max = Math.max(1, ...ranked.map((r) => r.revenue));
  return (
    <Card title="Sales leaderboard" description="Revenue closed per agent">
      {ranked.length === 0 ? (
        <p className="text-sm text-muted italic">No assigned leads or trips yet.</p>
      ) : (
        <div className="space-y-4">
          {ranked.map((ag, i) => {
            const initials = ag.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join("");
            const color = DV_COLORS[i % DV_COLORS.length];
            return (
              <div key={ag.userId}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${color} 18%, transparent)`,
                      color,
                    }}
                  >
                    {initials || "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">
                      {ag.name}
                    </p>
                    <p className="text-[11px] text-muted">
                      {ag.trips} trip{ag.trips === 1 ? "" : "s"} · {ag.won} won
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-[13px] font-semibold text-ink">
                    {formatINR(ag.revenue)}
                  </span>
                </div>
                <div className="tc-meter">
                  <i
                    style={{ width: `${(ag.revenue / max) * 100}%`, background: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// --- Booked vs collected, monthly bars --------------------------------------

function MonthlyBarsCard({
  byMonth,
}: {
  byMonth: { month: string; label: string; booked: number; collected: number }[];
}) {
  if (byMonth.length === 0) return null;
  // Scale to lakhs so the axis stays legible for INR figures.
  const bars = byMonth.map((m) => ({
    label: m.label,
    values: [
      Math.round(m.collected / 1000) / 100,
      Math.round(m.booked / 1000) / 100,
    ],
  }));
  return (
    <Card title="Booked vs collected" description="By month, in ₹ lakh">
      <div className="mb-3 flex items-center gap-4 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-[9px] rounded-[3px] bg-gold" />
          Collected
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-[9px] w-[9px] rounded-[3px]"
            style={{ background: "var(--dv-slate)" }}
          />
          Booked
        </span>
      </div>
      <Bars data={bars} h={200} colors={["var(--gold)", "var(--dv-slate)"]} />
    </Card>
  );
}

// --- Source attribution table -----------------------------------------------

function SourceCard({ sources }: { sources: SourceRow[] }) {
  return (
    <Card title="Source detail" description="Leads, conversion and revenue by channel">
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[440px]">
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
                <td className="py-2.5 text-ink">
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
                <td className="py-2.5 text-right font-mono tabular-nums text-ink font-semibold">
                  {formatINR(s.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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
            className="rounded-[10px] border border-line bg-paper-2 px-4 py-3"
          >
            <p className="tc-stat-label">{LEAD_STATUS_LABEL[r.status]}</p>
            <p className="tc-stat-val tnum mt-1 !text-2xl">{r.count}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
