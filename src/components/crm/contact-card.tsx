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
        // select-none stops a press-drag from selecting the card text
        // instead of starting the drag.
        "rounded-[10px] border border-line bg-paper p-4 shadow-soft cursor-grab active:cursor-grabbing transition-all select-none hover:-translate-y-0.5 hover:border-[var(--gold-line)] hover:shadow-lift",
        isDragging && "opacity-50 ring-2 ring-gold"
      )}
    >
      {/* The whole card is draggable. The Link must NOT stop pointer-down
          (that blocked the drag everywhere it covered) — dnd-kit's 6px
          activation distance already tells a click apart from a drag.
          draggable={false} kills the browser's native "drag the link". */}
      <Link
        href={`/contacts/${contact.id}`}
        draggable={false}
        className="block"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg text-ink leading-tight">
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
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted">
          {LEAD_SOURCE_LABEL[contact.source]}
        </p>

        {contact.destination && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
            <MapPin className="h-3.5 w-3.5 text-gold-deep" />
            {contact.destination}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="font-mono tabular-nums">{contact.adults}</span>
          </span>
          {contact.budget && (
            <span className="font-mono font-semibold text-gold-deep">
              {formatINR(contact.budget)}
            </span>
          )}
        </div>

        {contact.travelStartDate && (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            From {formatDate(contact.travelStartDate)}
          </div>
        )}

        {contact.nextFollowUpAt && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[10px] uppercase tracking-[0.16em]",
              overdue ? "bg-bad-soft text-[#9a4234]" : "bg-gold-soft text-gold-deep"
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
