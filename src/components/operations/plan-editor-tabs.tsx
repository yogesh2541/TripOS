"use client";

import { useState } from "react";
import type { TravelSegment } from "@prisma/client";
import { ItineraryEditor } from "@/components/itinerary-editor";
import { SegmentList } from "@/components/segments/segment-list";
import { PillToggle, type PillOption } from "@/components/ui/pill-toggle";
import type { ItineraryContent } from "@/lib/ai";

type View = "itinerary" | "transport";

export function PlanEditorTabs({
  tripId,
  destination,
  tripDays,
  itineraryContent,
  segments,
  tripStartDate = null,
}: {
  tripId: string;
  destination: string;
  tripDays: number;
  itineraryContent: ItineraryContent | null;
  segments: TravelSegment[];
  tripStartDate?: string | null;
}) {
  const [view, setView] = useState<View>("itinerary");

  const options: PillOption<View>[] = [
    { value: "itinerary", label: "Itinerary" },
    {
      value: "transport",
      label: "Transport",
      count: segments.length || undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <PillToggle options={options} value={view} onChange={setView} />

      {view === "itinerary" ? (
        <ItineraryEditor
          tripId={tripId}
          destination={destination}
          initial={itineraryContent}
          segments={segments}
          tripStartDate={tripStartDate}
        />
      ) : (
        <SegmentList
          tripId={tripId}
          tripDays={tripDays}
          segments={segments}
        />
      )}
    </div>
  );
}
