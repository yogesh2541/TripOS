import Link from "next/link";
import { LineChart, MessageCircle, Sparkles } from "lucide-react";
import type { Prisma, WhatsappDirection, WhatsappStatus } from "@prisma/client";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CommsFilterBar } from "@/components/whatsapp/comms-filter-bar";
import {
  WhatsappMessageRow,
  type WhatsappMessageRowData,
} from "@/components/whatsapp/whatsapp-message-row";
import { WhatsappComposer } from "@/components/whatsapp/whatsapp-composer";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";
import { isWhatsappConfigured } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

type SearchParams = {
  status?: string;
  direction?: string;
  q?: string;
  cursor?: string;
};

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getOrCreateDemoUser();

  const where: Prisma.WhatsappMessageWhereInput = { userId: user.id };
  if (searchParams.status) where.status = searchParams.status as WhatsappStatus;
  if (searchParams.direction)
    where.direction = searchParams.direction as WhatsappDirection;
  if (searchParams.q) {
    where.OR = [
      { phone: { contains: searchParams.q } },
      { message: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }

  const [items, totals] = await Promise.all([
    prisma.whatsappMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: {
        lead: { select: { id: true, name: true } },
        trip: { select: { id: true, destination: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    }),
    prisma.whatsappMessage.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const totalsByStatus: Record<WhatsappStatus, number> = {
    QUEUED: 0,
    SENT: 0,
    DELIVERED: 0,
    READ: 0,
    FAILED: 0,
  };
  for (const t of totals)
    totalsByStatus[t.status as WhatsappStatus] = t._count._all;

  const configured = isWhatsappConfigured();

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Communications
          </p>
          <h1 className="font-display text-4xl text-navy tracking-tight mt-1">
            WhatsApp activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every outbound message, delivery receipt and customer reply — one
            calm view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/communications/templates">
              <Sparkles className="h-4 w-4" />
              Templates
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/communications/automations">
              <LineChart className="h-4 w-4" />
              Automations
            </Link>
          </Button>
          <WhatsappComposer
            trigger={
              <Button>
                <MessageCircle className="h-4 w-4" />
                Quick send
              </Button>
            }
          />
        </div>
      </header>

      {!configured ? (
        <div className="mb-5 rounded-2xl border border-sand-200 bg-sand-50/60 px-4 py-3 text-xs text-sand-800">
          WhatsApp Cloud API isn't configured yet. Add{" "}
          <code className="rounded bg-white px-1 py-0.5">
            WHATSAPP_PHONE_NUMBER_ID
          </code>
          ,{" "}
          <code className="rounded bg-white px-1 py-0.5">
            WHATSAPP_ACCESS_TOKEN
          </code>{" "}
          and{" "}
          <code className="rounded bg-white px-1 py-0.5">
            WHATSAPP_WEBHOOK_VERIFY_TOKEN
          </code>{" "}
          to <code className="rounded bg-white px-1 py-0.5">.env</code>. Until
          then, sends are queued and recorded as failed; the wa.me fallback
          link still works.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-5 mb-6">
        <StatusTile label="Queued" value={totalsByStatus.QUEUED} tone="muted" />
        <StatusTile label="Sent" value={totalsByStatus.SENT} tone="outline" />
        <StatusTile
          label="Delivered"
          value={totalsByStatus.DELIVERED}
          tone="accent"
        />
        <StatusTile label="Read" value={totalsByStatus.READ} tone="success" />
        <StatusTile label="Failed" value={totalsByStatus.FAILED} tone="danger" />
      </section>

      <CommsFilterBar />

      <section className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            title="No messages match"
            body="Try clearing filters or sending your first WhatsApp message from a lead."
          />
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => (
              <WhatsappMessageRow key={m.id} m={m as WhatsappMessageRowData} />
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "outline" | "accent" | "success" | "danger";
}) {
  const toneClass = {
    muted: "border-line bg-white",
    outline: "border-line bg-white",
    accent: "border-sand-200 bg-sand-50/70",
    success: "border-emerald-100 bg-emerald-50/70",
    danger: "border-red-100 bg-red-50/70",
  }[tone];
  return (
    <div className={`rounded-2xl border ${toneClass} p-4`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-3xl text-navy mt-1">{value}</p>
    </div>
  );
}
