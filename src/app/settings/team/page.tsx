import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck, Users } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { MemberRow } from "@/components/team/member-row";
import { InviteRow } from "@/components/team/invite-row";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { agencyId, user } = await requireAgency();

  // Page is OWNER-only — Staff/Viewer don't manage team.
  if (user.activeAgencyRole !== "OWNER") {
    redirect("/");
  }

  const [members, invites, agency] = await Promise.all([
    prisma.membership.findMany({
      where: { agencyId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { agencyId, status: "PENDING" },
      include: { invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    }),
  ]);

  const ownerCount = members.filter((m) => m.role === "OWNER").length;

  return (
    <PageShell>
      <div className="mb-6">
        <Link
          href="/settings/agency"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Agency settings
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <p className="tc-eyebrow gold">Settings</p>
          <h1 className="tc-page-title mt-2.5">Team</h1>
          <p className="tc-page-sub max-w-xl">
            Invite teammates to {agency?.name ?? "your agency"} and pick how
            much they can do. Staff handle leads, trips and WhatsApp; Viewers
            can only read.
          </p>
        </div>
        <InviteMemberForm />
      </header>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl text-ink inline-flex items-center gap-2">
            <Users className="h-5 w-5 text-gold-deep" />
            Members
            <span className="text-xs text-muted font-sans font-mono tabular-nums">
              {members.length}
            </span>
          </h2>
        </div>
        <ul className="space-y-2">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              membership={{
                id: m.id,
                role: m.role,
                suspendedAt: m.suspendedAt,
                userId: m.user.id,
                user: {
                  name: m.user.name,
                  email: m.user.email,
                  image: m.user.image,
                },
                createdAt: m.createdAt,
              }}
              isSelf={m.user.id === user.id}
              ownerCount={ownerCount}
            />
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl text-ink inline-flex items-center gap-2">
            <Mail className="h-5 w-5 text-gold-deep" />
            Pending invites
            <span className="text-xs text-muted font-sans font-mono tabular-nums">
              {invites.length}
            </span>
          </h2>
        </div>
        {invites.length === 0 ? (
          <EmptyState
            title="No invites in flight"
            body="When you invite someone, they'll see up here until they accept."
            variant="inline"
          />
        ) : (
          <ul className="space-y-2">
            {invites.map((inv) => (
              <InviteRow
                key={inv.id}
                invite={{
                  id: inv.id,
                  email: inv.email,
                  role: inv.role,
                  token: inv.token,
                  expiresAt: inv.expiresAt,
                  invitedByName: inv.invitedBy.name ?? inv.invitedBy.email,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-[10px] uppercase tracking-[0.18em] text-muted inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3" />
        Role changes audit · {formatDate(new Date())}
      </p>
    </PageShell>
  );
}
