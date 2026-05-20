import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Compass,
  ExternalLink,
  Flag,
  Hotel,
  PlaneTakeoff,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { VendorStatTile } from "@/components/vendors/vendor-stat-tile";
import {
  MarkTripStartedButton,
  MarkTripCompletedButton,
} from "@/components/operations/trip-lifecycle-buttons";
import { NeedsAttention } from "@/components/operations/needs-attention";
import { getOperationsDashboard } from "@/server/services/operations-dashboard";
import {
  TRIP_STATUS_LABEL,
  TRIP_STATUS_TONE,
  VENDOR_ASSIGNMENT_CATEGORY_LABEL,
  VENDOR_ASSIGNMENT_STATUS_LABEL,
  VENDOR_ASSIGNMENT_STATUS_TONE,
  OPERATION_TASK_PRIORITY_LABEL,
  OPERATION_TASK_PRIORITY_TONE,
} from "@/lib/crm";
import { cn, formatDate, formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OperationsDashboardPage() {
  const d = await getOperationsDashboard();
  const todayLabel = d.today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Operations
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Today
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
      </header>

      <NeedsAttention snapshot={d} />

      {/* Stat tiles */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <VendorStatTile
          label="Departures today"
          value={d.stats.departuresToday}
          tone={d.stats.departuresToday > 0 ? "accent" : "default"}
        />
        <VendorStatTile
          label="In progress"
          value={d.stats.inProgress}
          tone={d.stats.inProgress > 0 ? "success" : "default"}
        />
        <VendorStatTile
          label="Awaiting confirmation"
          value={d.stats.awaitingConfirmation}
          tone={d.stats.awaitingConfirmation > 0 ? "accent" : "default"}
        />
        <VendorStatTile
          label="Overdue tasks"
          value={d.stats.overdueTasks}
          tone={d.stats.overdueTasks > 0 ? "danger" : "default"}
        />
        <VendorStatTile
          label="Unpaid to vendors"
          value={formatINR(d.stats.unpaidVendorBalance)}
          tone={d.stats.unpaidVendorBalance > 0 ? "danger" : "default"}
        />
      </section>

      {/* Alerts: lifecycle suggestions */}
      {d.shouldStartToday.length + d.shouldComplete.length > 0 ? (
        <section className="mb-8 rounded-2xl border border-sand-200 bg-sand-50/40 p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-sand-800" />
            <h2 className="font-display text-lg text-navy">
              Lifecycle suggestions
            </h2>
          </div>
          <div className="space-y-2">
            {d.shouldStartToday.map((t) => (
              <div
                key={t.tripId}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-line p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/trips/${t.tripId}`}
                    className="font-medium text-navy hover:text-sand-800"
                  >
                    {t.destination}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Departs {formatDate(t.startDate)} ·{" "}
                    {t.leadName ?? "—"}
                  </p>
                </div>
                <MarkTripStartedButton tripId={t.tripId} />
              </div>
            ))}
            {d.shouldComplete.map((t) => (
              <div
                key={t.tripId}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-line p-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/trips/${t.tripId}`}
                    className="font-medium text-navy hover:text-sand-800"
                  >
                    {t.destination}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trip ended {t.endDate ? formatDate(t.endDate) : "—"} ·{" "}
                    {t.leadName ?? "—"}
                  </p>
                </div>
                <MarkTripCompletedButton tripId={t.tripId} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 14-day calendar */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-2xl text-navy">
              Next 14 days
            </h2>
            <p className="text-sm text-muted-foreground">
              Departures and trip endings.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
          <div className="grid gap-2 grid-cols-7">
            {d.calendar.map((day) => (
              <CalendarCell key={day.date.toISOString()} day={day} />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today’s departures */}
        <Card>
          <CardHeader
            icon={<PlaneTakeoff className="h-4 w-4" />}
            title="Departures today"
            count={d.departuresToday.length}
          />
          {d.departuresToday.length === 0 ? (
            <Empty body="No departures scheduled today." />
          ) : (
            <ul className="divide-y divide-line/70">
              {d.departuresToday.map((t) => (
                <li
                  key={t.tripId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/trips/${t.tripId}`}
                      className="font-medium text-navy hover:text-sand-800 truncate inline-flex items-center gap-1"
                    >
                      {t.destination}
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Users className="inline h-3 w-3 mr-1" />
                      {t.travelers} pax · {t.days}d ·{" "}
                      {t.leadName ?? "Direct"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.confirmedCount}/{t.totalCount} ok
                    </span>
                    <Badge variant={TRIP_STATUS_TONE[t.status]}>
                      {TRIP_STATUS_LABEL[t.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* In progress */}
        <Card>
          <CardHeader
            icon={<Flag className="h-4 w-4" />}
            title="In progress"
            count={d.inProgress.length}
          />
          {d.inProgress.length === 0 ? (
            <Empty body="No trips currently underway." />
          ) : (
            <ul className="divide-y divide-line/70">
              {d.inProgress.map((t) => (
                <li
                  key={t.tripId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/trips/${t.tripId}`}
                      className="font-medium text-navy hover:text-sand-800 truncate"
                    >
                      {t.destination}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.startDate ? formatDate(t.startDate) : "—"}
                      {t.endDate ? ` → ${formatDate(t.endDate)}` : ""}
                      {" · "}
                      {t.leadName ?? "—"}
                    </p>
                  </div>
                  <Badge variant={TRIP_STATUS_TONE[t.status]}>
                    {TRIP_STATUS_LABEL[t.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Pending vendor confirmations */}
        <Card>
          <CardHeader
            icon={<Hotel className="h-4 w-4" />}
            title="Awaiting vendor confirmation"
            count={d.pendingAssignments.length}
          />
          {d.pendingAssignments.length === 0 ? (
            <Empty body="Every booked vendor on every active trip is confirmed." />
          ) : (
            <ul className="divide-y divide-line/70 max-h-[420px] overflow-y-auto">
              {d.pendingAssignments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">
                      {p.vendor.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      <Compass className="inline h-3 w-3 mr-1" />
                      <Link
                        href={`/trips/${p.tripId}`}
                        className="hover:text-navy"
                      >
                        {p.tripDestination}
                      </Link>
                      {" · "}
                      {VENDOR_ASSIGNMENT_CATEGORY_LABEL[p.category]} · {p.title}
                    </p>
                  </div>
                  <Badge variant={VENDOR_ASSIGNMENT_STATUS_TONE[p.status]}>
                    {VENDOR_ASSIGNMENT_STATUS_LABEL[p.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Overdue tasks */}
        <Card>
          <CardHeader
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Overdue ops tasks"
            count={d.overdueTasks.length}
            tone={d.overdueTasks.length > 0 ? "danger" : "default"}
          />
          {d.overdueTasks.length === 0 ? (
            <Empty body="Nothing overdue." />
          ) : (
            <ul className="divide-y divide-line/70 max-h-[420px] overflow-y-auto">
              {d.overdueTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      <Link
                        href={`/trips/${t.tripId}`}
                        className="hover:text-navy"
                      >
                        {t.tripDestination}
                      </Link>
                      {" · Due "}
                      {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </p>
                  </div>
                  <Badge variant={OPERATION_TASK_PRIORITY_TONE[t.priority]}>
                    {OPERATION_TASK_PRIORITY_LABEL[t.priority]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Unpaid vendor balances */}
        <Card>
          <CardHeader
            icon={<Wallet className="h-4 w-4" />}
            title="Outstanding vendor balances"
            count={d.vendorBalances.length}
            tone={d.vendorBalances.length > 0 ? "danger" : "default"}
          />
          {d.vendorBalances.length === 0 ? (
            <Empty body="All vendor balances are settled." />
          ) : (
            <ul className="divide-y divide-line/70">
              {d.vendorBalances.map((v) => (
                <li
                  key={v.vendorId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/vendors/${v.vendorId}`}
                      className="font-medium text-navy hover:text-sand-800 truncate"
                    >
                      {v.vendorName}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Paid {formatINR(v.paid)} of {formatINR(v.committed)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-red-700 tabular-nums">
                    {formatINR(v.outstanding)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader
            icon={<Clock className="h-4 w-4" />}
            title="Recent operational activity"
            count={d.recentActivity.length}
          />
          {d.recentActivity.length === 0 ? (
            <Empty body="No recent ops events." />
          ) : (
            <ul className="space-y-3 max-h-[420px] overflow-y-auto">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ivory border border-line text-sand-700 shrink-0">
                    <Receipt className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-navy truncate">
                        {a.title}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                      </span>
                    </div>
                    {a.trip ? (
                      <Link
                        href={`/trips/${a.trip.id}`}
                        className="text-[11px] text-muted-foreground hover:text-navy"
                      >
                        {a.trip.destination}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      {children}
    </section>
  );
}
function CardHeader({
  icon,
  title,
  count,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  tone?: "default" | "danger";
}) {
  return (
    <header className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border",
            tone === "danger"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-line bg-ivory text-sand-800"
          )}
        >
          {icon}
        </span>
        <h3 className="font-display text-lg text-navy">{title}</h3>
      </div>
      {typeof count === "number" ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </header>
  );
}
function Empty({ body }: { body: string }) {
  return (
    <p className="rounded-xl bg-ivory border border-dashed border-line/70 p-4 text-center text-xs text-muted-foreground">
      {body}
    </p>
  );
}

function CalendarCell({
  day,
}: {
  day: import("@/server/services/operations-dashboard").CalendarDay;
}) {
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  const dayNum = day.date.getDate();
  const monthShort = day.date.toLocaleDateString("en-IN", {
    month: "short",
  });
  const weekdayShort = day.date.toLocaleDateString("en-IN", {
    weekday: "short",
  });

  return (
    <div
      className={cn(
        "rounded-xl border min-h-[110px] p-2 flex flex-col gap-1.5 text-[11px]",
        day.isToday
          ? "border-sand-300 bg-sand-50/60"
          : "border-line bg-white hover:bg-ivory/50",
        isWeekend && !day.isToday && "bg-ivory/40"
      )}
    >
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "font-display text-base",
            day.isToday ? "text-sand-800" : "text-navy"
          )}
        >
          {dayNum}
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          {weekdayShort}
          {dayNum === 1 ? ` · ${monthShort}` : ""}
        </span>
      </div>
      <div className="space-y-1">
        {day.departures.map((t) => (
          <Link
            key={`d-${t.tripId}`}
            href={`/trips/${t.tripId}`}
            className="block truncate rounded-md bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.5 text-emerald-800 hover:bg-emerald-100"
            title={`Departs: ${t.destination}`}
          >
            <PlaneTakeoff className="h-2.5 w-2.5 inline mr-0.5" />
            {t.destination}
          </Link>
        ))}
        {day.endsToday.map((t) => (
          <Link
            key={`e-${t.tripId}`}
            href={`/trips/${t.tripId}`}
            className="block truncate rounded-md bg-sand-50 border border-sand-200/70 px-1.5 py-0.5 text-sand-800 hover:bg-sand-100"
            title={`Ends: ${t.destination}`}
          >
            <CalendarDays className="h-2.5 w-2.5 inline mr-0.5" />
            {t.destination}
          </Link>
        ))}
      </div>
    </div>
  );
}
