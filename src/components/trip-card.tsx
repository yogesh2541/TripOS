"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, User, Users } from "lucide-react";
import type { TripStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { TRIP_STATUS_LABEL, TRIP_STATUS_TONE } from "@/lib/crm";
import { formatDate } from "@/lib/utils";

type Props = {
  id: string;
  destination: string;
  days: number;
  travelers: number;
  travelType: string;
  status: TripStatus;
  leadName?: string | null;
  startDate: Date | string | null;
  createdAt: Date | string;
  index?: number;
};

export function TripCard({
  id,
  destination,
  days,
  travelers,
  travelType,
  status,
  leadName,
  startDate,
  createdAt,
  index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/trips/${id}`}
        className="group block rounded-2xl border border-line bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand-700">
              {travelType}
            </p>
            <h3 className="mt-2 font-display text-2xl text-navy leading-tight truncate">
              {destination}
            </h3>
            {leadName && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span className="truncate">{leadName}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant={TRIP_STATUS_TONE[status]}>
              {TRIP_STATUS_LABEL[status]}
            </Badge>
            <span className="opacity-0 transition-opacity group-hover:opacity-100 text-navy">
              <ArrowUpRight className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {days} days
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {travelers}
          </span>
          {startDate && (
            <span className="ml-auto text-[11px] uppercase tracking-widest">
              {formatDate(startDate)}
            </span>
          )}
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          Created {formatDate(createdAt)}
        </p>
      </Link>
    </motion.div>
  );
}
