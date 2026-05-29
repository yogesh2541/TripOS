import Link from "next/link";
import {
  CalendarClock,
  MessageCircle,
  Plus,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ui/view-toggle";
import { StatTile } from "@/components/crm/stat-tile";
import {
  ActivityFeed,
  type ActivityFeedItem,
} from "@/components/crm/activity-feed";
import { FollowUpRow, type FollowUpRowData } from "@/components/crm/follow-up-row";
import { NewLeadDialog } from "@/components/crm/contact-form-dialog";
import { OneTimeHint } from "@/components/ui/one-time-hint";
import { OnboardingPanel } from "@/components/onboarding-panel";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAgency } from "@/lib/session";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Landing } from "@/components/marketing/landing";
import { WelcomeWalkthrough } from "@/components/welcome-walkthrough";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { scope?: string; tour?: string };
}) {
  // Logged-out visitors get the public marketing landing; the authenticated
  // dashboard lives at the same "/" for signed-in users.
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return (
      <MarketingShell>
        <Landing />
      </MarketingShell>
    );
  }

  const { agencyId, user } = await requireAgency();
  const canEdit = user.activeAgencyRole !== "VIEWER";

  // Personal lens: "You" (default) shows only what this user owns; "Agency"
  // widens to everything. Multi-tenant teams want the personal view by
  // default — a salesperson's daily plate, not the whole agency's.
  const scope = searchParams.scope === "agency" ? "agency" : "mine";
  const mine = scope === "mine";

  // Scoped filter fragments. `leadFilter` is `{}` for agency view, so the
  // queries below collapse to plain agency scoping when not personal.
  const leadFilter: Prisma.ContactWhereInput = mine ? { ownerId: user.id } : {};
  const tripFilter: Prisma.TripWhereInput = mine ? { ownerId: user.id } : {};

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    leadsTotal,
    leadsActive,
    leadsWonThisMonth,
    revenueAgg,
    overdueCount,
    customers,
    activitiesRaw,
    upcomingTasks,
    unreadInboundCount,
  ] = await Promise.all([
    prisma.contact.count({
      where: { agencyId, deletedAt: null, ...leadFilter },
    }),
    prisma.contact.count({
      where: {
        agencyId,
        deletedAt: null,
        status: { notIn: ["WON", "LOST"] },
        ...leadFilter,
      },
    }),
    prisma.contact.count({
      where: {
        agencyId,
        deletedAt: null,
        status: "WON",
        updatedAt: { gte: startOfMonth },
        ...leadFilter,
      },
    }),
    prisma.payment.aggregate({
      where: {
        booking: {
          trip: { agencyId, ...tripFilter },
          status: { not: "CANCELLED" },
        },
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
    prisma.task.count({
      where: {
        completedAt: null,
        dueAt: { lt: now },
        contact: { agencyId, deletedAt: null, ...leadFilter },
      },
    }),
    prisma.contact.count({
      where: {
        agencyId,
        deletedAt: null,
        convertedAt: { not: null },
        ...leadFilter,
      },
    }),
    prisma.activity.findMany({
      where: { contact: { agencyId, deletedAt: null, ...leadFilter } },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.task.findMany({
      where: {
        completedAt: null,
        contact: { agencyId, deletedAt: null, ...leadFilter },
      },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
    // Inbound WhatsApp messages in the last 7 days — proxy for "needs reply".
    prisma.whatsappMessage.count({
      where: {
        agencyId,
        direction: "INBOUND",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...(mine ? { contact: { ownerId: user.id } } : {}),
      },
    }),
  ]);

  const conversionPct =
    leadsTotal > 0 ? Math.round((leadsWonThisMonth / leadsTotal) * 100) : 0;

  const monthLabel = now.toLocaleString("en-IN", { month: "long" });

  const activities = activitiesRaw as unknown as ActivityFeedItem[];
  const followUps: FollowUpRowData[] = upcomingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    completedAt: t.completedAt,
    contact: t.contact ? { id: t.contact.id, name: t.contact.name } : null,
  }));

  const firstName = (user.name ?? "").trim().split(/\s+/)[0];

  return (
    <PageShell>
      <WelcomeWalkthrough
        userId={user.id}
        firstName={user.name?.trim().split(/\s+/)[0] ?? null}
        forceOpen={searchParams.tour === "1"}
      />
      <OnboardingPanel />

      <OneTimeHint
        id="welcome-search"
        title="Press ⌘K (or Ctrl+K) to find anything fast"
        variant="accent"
        className="mb-8"
      >
        Search across leads, trips, vendors, and vouchers from anywhere in
        the app — even from inside a trip workspace.
      </OneTimeHint>

      <section className="flex flex-wrap items-end justify-between gap-6 mb-7">
        <div>
          <p className="tc-eyebrow gold">
            <Sparkles className="h-[13px] w-[13px]" />
            {monthLabel}, {now.getFullYear()}
          </p>
          <h1 className="tc-page-title mt-2.5 text-balance">
            {mine
              ? firstName
                ? `${firstName}'s pipeline.`
                : "Your pipeline."
              : "Agency pipeline."}
          </h1>
          <p className="tc-page-sub">
            {mine
              ? "Leads you own, follow-ups on your plate, and the revenue you're closing this month."
              : "Everything across the agency — every teammate's leads, follow-ups and revenue."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ViewToggle
            param="scope"
            defaultValue="mine"
            options={[
              { value: "mine", label: "You", icon: "user" },
              { value: "agency", label: "Agency", icon: "users" },
            ]}
          />
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <NewLeadDialog
                trigger={
                  <Button>
                    <UserPlus className="h-4 w-4" />
                    New contact
                  </Button>
                }
              />
              <Link href="/trips/new">
                <Button variant="outline">
                  <Plus className="h-4 w-4" />
                  New trip
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Viewer access · read-only
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <StatTile
          icon={<Users className="h-3 w-3" />}
          label="Active leads"
          value={String(leadsActive)}
          hint={`${leadsTotal} total in pipeline`}
          href="/contacts"
          tone="accent"
        />
        <StatTile
          icon={<TrendingUp className="h-3 w-3" />}
          label="Won this month"
          value={`${leadsWonThisMonth}`}
          hint={`${conversionPct}% conversion`}
          href="/customers"
          tone="success"
        />
        <StatTile
          icon={<Wallet className="h-3 w-3" />}
          label="Collected this month"
          value={formatINR(revenueAgg._sum.amount ?? 0)}
          hint={`${customers} customers on the books`}
          href="/bookings"
          tone="navy"
        />
        <StatTile
          icon={<CalendarClock className="h-3 w-3" />}
          label="Overdue follow-ups"
          value={String(overdueCount)}
          hint={overdueCount > 0 ? "Triage first" : "All clear"}
          href="/follow-ups"
          tone={overdueCount > 0 ? "danger" : "default"}
        />
        <StatTile
          icon={<MessageCircle className="h-3 w-3" />}
          label="WhatsApp replies (7d)"
          value={String(unreadInboundCount)}
          hint={unreadInboundCount > 0 ? "Open and reply" : "No new replies"}
          href="/communications?direction=INBOUND"
          tone="default"
        />
      </section>

      <section className="grid gap-10 lg:grid-cols-[1.5fr_1fr] items-start">
        <div>
          <SectionHeading
            title="Recent activity"
            cta={{ label: "All leads", href: "/contacts" }}
          />
          <ActivityFeed activities={activities} />
        </div>

        <div>
          <SectionHeading
            title="Up next"
            cta={{ label: "All follow-ups", href: "/follow-ups" }}
          />
          {followUps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-paper-2 p-8 text-center text-sm text-muted-foreground">
              Nothing scheduled. Add a follow-up from any contact.
            </div>
          ) : (
            <ul className="space-y-2">
              {followUps.map((t) => (
                <FollowUpRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function SectionHeading({
  title,
  cta,
}: {
  title: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="tc-sec-head">
      <h2>{title}</h2>
      {cta && (
        <Link href={cta.href} className="lnk">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
