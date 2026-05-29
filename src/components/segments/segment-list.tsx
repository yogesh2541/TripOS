"use client";

import { useTransition } from "react";
import {
  FileText,
  Loader2,
  Pencil,
  Plane,
  Plus,
  Train,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { TravelSegment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { SegmentFormDialog } from "@/components/segments/segment-form-dialog";
import {
  addSegmentToQuoteAction,
  deleteTravelSegmentAction,
} from "@/server/actions/segments";
import { formatDate } from "@/lib/utils";

type Props = {
  tripId: string;
  tripDays: number;
  tripStartDate?: string | null;
  segments: TravelSegment[];
};

export function SegmentList({
  tripId,
  tripDays,
  tripStartDate = null,
  segments,
}: Props) {
  const flights = segments.filter((s) => s.type === "FLIGHT");
  const trains = segments.filter((s) => s.type === "TRAIN");

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="tc-eyebrow gold">
            Transport
          </p>
          <h2 className="font-display text-2xl text-ink mt-1">
            Travel segments
          </h2>
          <p className="mt-1 text-xs text-muted">
            Flights & trains attached to this trip. Day numbers map to the
            itinerary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentFormDialog
            tripId={tripId}
            tripDays={tripDays}
            tripStartDate={tripStartDate}
            defaultType="FLIGHT"
            trigger={
              <Button size="sm" variant="outline">
                <Plane className="h-3.5 w-3.5" />
                Add flight
              </Button>
            }
          />
          <SegmentFormDialog
            tripId={tripId}
            tripDays={tripDays}
            tripStartDate={tripStartDate}
            defaultType="TRAIN"
            trigger={
              <Button size="sm">
                <Train className="h-3.5 w-3.5" />
                Add train
              </Button>
            }
          />
        </div>
      </header>

      {segments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-paper-2 p-12 text-center">
          <Plus className="h-5 w-5 mx-auto text-muted mb-3" />
          <p className="font-display text-2xl text-ink">No transport yet</p>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Add a flight or train and it will surface above the matching day
            in the itinerary, and inside the proposal.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {flights.length > 0 && (
            <Section title="Flights" icon={<Plane className="h-3.5 w-3.5" />}>
              {flights.map((s) => (
                <SegmentRow
                  key={s.id}
                  segment={s}
                  tripId={tripId}
                  tripDays={tripDays}
                  tripStartDate={tripStartDate}
                />
              ))}
            </Section>
          )}
          {trains.length > 0 && (
            <Section title="Trains" icon={<Train className="h-3.5 w-3.5" />}>
              {trains.map((s) => (
                <SegmentRow
                  key={s.id}
                  segment={s}
                  tripId={tripId}
                  tripDays={tripDays}
                  tripStartDate={tripStartDate}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-gold-deep flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SegmentRow({
  segment,
  tripId,
  tripDays,
  tripStartDate,
}: {
  segment: TravelSegment;
  tripId: string;
  tripDays: number;
  tripStartDate?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const isFlight = segment.type === "FLIGHT";
  const identifier = isFlight
    ? [segment.airline, segment.flightNumber].filter(Boolean).join(" · ")
    : [segment.trainName, segment.trainNumber].filter(Boolean).join(" · ");
  const seatLine = !isFlight
    ? [segment.coach && `Coach ${segment.coach}`, segment.seat && `Seat ${segment.seat}`]
        .filter(Boolean)
        .join(" · ")
    : segment.pnr
      ? `PNR ${segment.pnr}`
      : null;

  function remove() {
    if (!confirm("Delete this segment?")) return;
    startTransition(async () => {
      try {
        await deleteTravelSegmentAction(segment.id);
        toast.success("Segment deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  function addToQuote() {
    startTransition(async () => {
      try {
        const r = await addSegmentToQuoteAction(segment.id);
        toast.success(`Added to quote v${r.version}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add to quote");
      }
    });
  }

  return (
    <article className="rounded-lg border border-line bg-paper p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gold-deep font-mono tabular-nums">
              Day {segment.dayNumber}
            </span>
            <p className="font-display text-lg text-ink leading-tight">
              {segment.from} <span className="text-gold-deep">→</span>{" "}
              {segment.to}
            </p>
          </div>
          {identifier && (
            <p className="mt-1 text-sm text-ink/80">{identifier}</p>
          )}
          <p className="mt-1 text-xs text-faint font-mono tabular-nums">
            {formatDate(segment.departureTime)}
            {" · "}
            {new Date(segment.departureTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
            {" → "}
            {new Date(segment.arrivalTime).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </p>
          {seatLine && (
            <p className="mt-1 text-xs text-muted">{seatLine}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <SegmentFormDialog
            tripId={tripId}
            tripDays={tripDays}
            tripStartDate={tripStartDate}
            segment={segment}
            trigger={
              <button
                className="h-8 w-8 rounded-[8px] border border-line text-muted hover:text-ink hover:border-[var(--gold-line)] transition-colors flex items-center justify-center"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            }
          />
          <button
            type="button"
            onClick={addToQuote}
            disabled={isPending}
            className="h-8 px-3 rounded-[8px] border border-line text-xs text-ink hover:border-[var(--gold-line)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            title="Add to quote"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            Quote
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="h-8 w-8 rounded-[8px] border border-line text-muted hover:text-bad hover:border-bad/40 transition-colors flex items-center justify-center disabled:opacity-50"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
