import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb } from "@/components/breadcrumb";
import { GlobalSearch } from "@/components/global-search";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { getSessionUser } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platform-admin";
import { getEffectivePlan } from "@/server/services/subscription";
import { cn } from "@/lib/utils";

export async function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const user = await getSessionUser();
  const plan = user ? await getEffectivePlan(user.activeAgencyId) : null;

  return (
    <div className={cn("min-h-screen bg-canvas text-ink flex", className)}>
      {user ? (
        <AppSidebar
          agencyName={user.activeAgencyName}
          userName={user.name ?? undefined}
        />
      ) : null}

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} />
        {plan ? <PlanBanner plan={plan} /> : null}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8 pt-7 md:pt-[30px] pb-16">
            {children}
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function PlanBanner({
  plan,
}: {
  plan: Awaited<ReturnType<typeof getEffectivePlan>>;
}) {
  // Lapsed trial / inactive subscription — strongest nudge.
  if (plan.needsUpgrade) {
    return (
      <BannerBar tone="danger">
        Your free trial has ended. Upgrade to keep Pro features and add team
        members.
      </BannerBar>
    );
  }
  // Trial ending soon.
  if (plan.trialActive && plan.trialDaysLeft !== null && plan.trialDaysLeft <= 3) {
    return (
      <BannerBar tone="warn">
        {plan.trialDaysLeft === 0
          ? "Your trial ends today."
          : `${plan.trialDaysLeft} day${plan.trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
        Pick a plan to keep going without interruption.
      </BannerBar>
    );
  }
  return null;
}

function BannerBar({
  tone,
  children,
}: {
  tone: "warn" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "print:hidden border-b px-5 md:px-10 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm",
        tone === "danger"
          ? "bg-red-50 border-red-100 text-red-800"
          : "bg-sand-50 border-sand-200 text-sand-900"
      )}
    >
      <span className="inline-flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        {children}
      </span>
      <Link
        href="/settings/billing"
        className="shrink-0 rounded-full bg-navy px-3.5 py-1 text-xs font-medium text-ivory hover:bg-navy/90 transition-colors"
      >
        View plans
      </Link>
    </div>
  );
}

function TopBar({
  user,
}: {
  user: Awaited<ReturnType<typeof getSessionUser>>;
}) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3.5 border-b border-line bg-[rgba(244,242,236,.82)] px-5 md:px-[22px] backdrop-blur-md print:hidden"
      style={{ height: "var(--top-h)" }}
    >
      {/* Mobile: hamburger opens the nav drawer. Desktop: sidebar covers it. */}
      <div className="md:hidden">
        <MobileNav />
      </div>
      <Breadcrumb />
      <div className="flex-1" />
      <GlobalSearch />
      {user ? <NotificationBell /> : null}
      {user ? (
        <UserMenu
          name={user.name}
          email={user.email}
          agencyName={user.activeAgencyName}
          role={user.activeAgencyRole}
          isPlatformAdmin={isPlatformAdminEmail(user.email)}
        />
      ) : null}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas print:hidden">
      <div className="px-5 md:px-8 flex h-14 items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} TripCraft</span>
        <span className="tracking-widest uppercase hidden sm:inline">
          Crafted for premium travel
        </span>
      </div>
    </footer>
  );
}
