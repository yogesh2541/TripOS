import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { MessageStatusPill } from "./message-status-pill";

type Scope =
  | { leadId: string }
  | { tripId: string }
  | { customerId: string }
  | { invoiceId: string };

/**
 * Compact badge for the lead/trip/customer/invoice header: shows the count
 * of WhatsApp messages exchanged and the status of the most recent one.
 *
 * Async server component — runs the count + last-message query inline. The
 * surrounding page is already a server component in TripCraft.
 */
export async function WhatsappBadge({
  scope,
  href,
  className,
}: {
  scope: Scope;
  href?: string;
  className?: string;
}) {
  const where =
    "leadId" in scope
      ? { leadId: scope.leadId }
      : "tripId" in scope
        ? { tripId: scope.tripId }
        : "customerId" in scope
          ? { customerId: scope.customerId }
          : { invoiceId: scope.invoiceId };

  const [count, last] = await Promise.all([
    prisma.whatsappMessage.count({ where }),
    prisma.whatsappMessage.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { status: true, direction: true, createdAt: true },
    }),
  ]);

  if (count === 0) return null;

  const body = (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-navy",
        className
      )}
    >
      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
      <span className="font-medium">{count}</span>
      <span className="text-muted-foreground text-[10px] uppercase tracking-[0.16em]">
        WhatsApp
      </span>
      {last ? (
        <MessageStatusPill
          status={last.direction === "INBOUND" ? "DELIVERED" : last.status}
        />
      ) : null}
    </span>
  );

  return href ? (
    <Link href={href} className="inline-flex">
      {body}
    </Link>
  ) : (
    body
  );
}
