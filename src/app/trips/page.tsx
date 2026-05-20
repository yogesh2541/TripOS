import Link from "next/link";
import { Plus, Compass } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { TripCard } from "@/components/trip-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TripsIndexPage() {
  const user = await getOrCreateDemoUser();
  const trips = await prisma.trip.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell>
      <header className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-700">
            Studio
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl text-navy leading-tight">
            Trips
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every itinerary you've drafted, in one place.
          </p>
        </div>
        <Link href="/trips/new">
          <Button>
            <Plus className="h-4 w-4" />
            New trip
          </Button>
        </Link>
      </header>

      {trips.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" />}
          title="Craft your first proposal"
          body="Start with a destination and a few days — we'll generate a luxury itinerary draft you can shape from there."
          action={
            <Link href="/trips/new">
              <Button>
                <Plus className="h-4 w-4" />
                Create new trip
              </Button>
            </Link>
          }
          hint="Tip: convert a Won lead to skip the form"
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((t, i) => (
            <TripCard
              key={t.id}
              index={i}
              id={t.id}
              destination={t.destination}
              days={t.days}
              travelers={t.travelers}
              travelType={t.travelType}
              startDate={t.startDate}
              createdAt={t.createdAt}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
