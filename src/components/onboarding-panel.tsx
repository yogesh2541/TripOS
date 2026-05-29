import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { isWhatsappConfiguredForAgency } from "@/server/services/integrations";

// First-run checklist. Renders as a card on the dashboard until every
// foundational piece of TripCraft is set up. Once everything is in place,
// returns null and disappears for good.
//
// Why a checklist instead of a modal wizard:
//   - Non-interruptive — operators can ignore and start with the bits they care about
//   - Survives sessions naturally (state is the DB, not localStorage)
//   - Adapts as the user makes progress — items drop off as they're done
//   - Lets us add new "first-time" steps later without re-running a flow

type Step = {
  key: string;
  label: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
};

export async function OnboardingPanel() {
  const { agencyId, user } = await requireAgency();

  const [agency, templateCount, leadCount, memberCount, waConfigured] =
    await Promise.all([
      prisma.agencySettings.findUnique({
        where: { agencyId },
        select: { legalName: true, gstin: true, logoUrl: true },
      }),
      prisma.whatsappTemplate.count({ where: { agencyId, isActive: true } }),
      prisma.contact.count({ where: { agencyId, deletedAt: null } }),
      prisma.membership.count({ where: { agencyId } }),
      isWhatsappConfiguredForAgency(agencyId),
    ]);

  const steps: Step[] = [
    {
      key: "agency",
      label: "Add your agency identity",
      hint: "Legal name and GSTIN — used on every invoice and proposal.",
      href: "/settings/agency",
      cta: "Open settings",
      done: Boolean(agency?.legalName && agency.gstin),
    },
    {
      key: "logo",
      label: "Upload your logo",
      hint: "Appears on shared proposals, invoices and vouchers.",
      href: "/settings/agency",
      cta: "Add logo",
      done: Boolean(agency?.logoUrl),
    },
    {
      key: "whatsapp",
      label: "Connect WhatsApp",
      hint: "Send proposals, invoices and reminders straight from a contact.",
      href: "/settings/integrations",
      cta: "Set up WhatsApp",
      done: waConfigured,
    },
    {
      key: "template",
      label: "Register your first template",
      hint: "Reusable bodies for proposals, follow-ups and reminders.",
      href: "/communications/templates",
      cta: "Add template",
      done: templateCount > 0,
    },
    {
      key: "contact",
      label: "Capture your first contact",
      hint: "From Instagram, WhatsApp, a referral — anywhere.",
      href: "/contacts",
      cta: "New contact",
      done: leadCount > 0,
    },
  ];

  if (user.activeAgencyRole === "OWNER") {
    steps.push({
      key: "team",
      label: "Invite your team",
      hint: "Sales people, operations, accountants — bring them into the agency.",
      href: "/settings/team",
      cta: "Invite teammates",
      done: memberCount > 1,
    });
  }

  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;

  const completed = steps.length - remaining.length;
  const next = remaining[0];

  return (
    <section className="mb-10 rounded-lg border border-[var(--gold-line)] bg-gold-soft p-6 md:p-8 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tc-eyebrow gold inline-flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Getting started · {completed} of {steps.length} done
          </p>
          <h2 className="mt-3 font-display text-2xl md:text-3xl text-ink">
            A few essentials to unlock everything.
          </h2>
          <p className="mt-1.5 text-sm text-muted max-w-xl">
            TripCraft works better when these are in place. Knock them out in
            any order — this card disappears once you're done.
          </p>
        </div>
        <Link
          href={next.href}
          className="inline-flex items-center gap-2 rounded-[8px] bg-inkwash text-[var(--on-dark)] px-5 py-2.5 text-sm font-medium shadow-soft hover:bg-inkwash/90 transition-colors"
        >
          {next.cta}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.key}
            className={
              "flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors " +
              (s.done
                ? "border-ok/20 bg-ok-soft/40"
                : "border-line bg-paper hover:border-line-2")
            }
          >
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-ok mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p
                className={
                  "text-sm font-medium " +
                  (s.done ? "text-ok line-through" : "text-ink")
                }
              >
                {s.label}
              </p>
              {!s.done ? (
                <>
                  <p className="text-xs text-muted mt-0.5">
                    {s.hint}
                  </p>
                  <Link
                    href={s.href}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-gold-deep hover:text-ink"
                  >
                    {s.cta}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!waConfigured ? (
        <p className="mt-5 text-[11px] text-muted inline-flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3 text-ok" />
          Connect your WhatsApp Business API in{" "}
          <Link href="/settings/integrations" className="underline">
            Settings → Integrations
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
