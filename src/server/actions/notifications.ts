"use server";

import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";

export type NotificationItem = {
  id: string;
  kind: "whatsapp_inbound" | "quote_accepted";
  title: string;
  body: string;
  href: string;
  leadName: string | null;
  createdAt: string; // ISO — serializable across the action boundary
};

/**
 * Recent things worth the operator's attention — inbound WhatsApp replies
 * and accepted quotes from the last 7 days. Polled by the notification
 * bell. Agency-scoped.
 */
export async function recentNotificationsAction(): Promise<NotificationItem[]> {
  const { agencyId } = await requireAgency();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [inbound, acceptedQuotes] = await Promise.all([
    prisma.whatsappMessage.findMany({
      where: {
        agencyId,
        direction: "INBOUND",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { contact: { select: { id: true, name: true } } },
    }),
    prisma.activity.findMany({
      where: {
        type: "QUOTE_ACCEPTED",
        createdAt: { gte: since },
        contact: { agencyId },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { contact: { select: { id: true, name: true } } },
    }),
  ]);

  const items: NotificationItem[] = [
    ...inbound.map((m) => ({
      id: `wa-${m.id}`,
      kind: "whatsapp_inbound" as const,
      title: m.contact?.name
        ? `${m.contact.name} replied on WhatsApp`
        : "New WhatsApp message",
      body: m.message.slice(0, 90),
      href: m.contactId ? `/contacts/${m.contactId}` : "/communications?direction=INBOUND",
      leadName: m.contact?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    ...acceptedQuotes.map((a) => ({
      id: `qa-${a.id}`,
      kind: "quote_accepted" as const,
      title: a.contact?.name ? `${a.contact.name} accepted a quote` : a.title,
      body: a.title,
      href: a.contactId ? `/contacts/${a.contactId}` : "/contacts",
      leadName: a.contact?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  ];

  // Newest first, capped.
  items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return items.slice(0, 20);
}
