"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { cn, formatDate, formatINR } from "@/lib/utils";
import { LEAD_SOURCE_LABEL } from "@/lib/crm";
import type { LeadSource } from "@prisma/client";
import { InlineWhatsappBadge } from "@/components/whatsapp/inline-whatsapp-badge";

export type LeadCardData = {
  id: string;
  name: string;
  destination: string | null;
  source: LeadSource;
  budget: number | null;
  adults: number;
  travelStartDate: Date | string | null;
  nextFollowUpAt: Date | string | null;
  wa?: {
    count: number;
    unreadInbound: number;
    lastDirection: "INBOUND" | "OUTBOUND";
  } | null;
};

export function LeadCard({ contact }: { contact: LeadCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue =
    contact.nextFollowUpAt && new Date(contact.nextFollowUpAt) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-2xl border border-line bg-white p-4 shadow-soft cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-50 ring-2 ring-sand"
      )}
    >
      <Link
        href={`/contacts/${contact.id}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="block"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg text-navy leading-tight">
            {contact.name}
          </p>
          {contact.wa ? (
            <InlineWhatsappBadge
              count={contact.wa.count}
              unreadInbound={contact.wa.unreadInbound}
              lastDirection={contact.wa.lastDirection}
            />
          ) : null}
        </div>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {LEAD_SOURCE_LABEL[contact.source]}
        </p>

        {contact.destination && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-ink/80">
            <MapPin className="h-3.5 w-3.5 text-sand-700" />
            {contact.destination}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {contact.adults}
          </span>
          {contact.budget && (
            <span className="font-medium text-navy">
              {formatINR(contact.budget)}
            </span>
          )}
        </div>

        {contact.travelStartDate && (
          <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            From {formatDate(contact.travelStartDate)}
          </div>
        )}

        {contact.nextFollowUpAt && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em]",
              overdue
                ? "bg-red-50 text-red-700"
                : "bg-sand-50 text-sand-800"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {overdue ? "Overdue" : "Follow-up"} {" "}
            {formatDate(contact.nextFollowUpAt)}
          </div>
        )}
      </Link>
    </div>
  );
}
