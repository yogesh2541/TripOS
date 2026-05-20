"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, PlaneTakeoff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  markTripStartedAction,
  markTripCompletedAction,
} from "@/server/actions/trips";

export function MarkTripStartedButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="accent"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markTripStartedAction(tripId);
            toast.success("Trip marked in progress");
            router.refresh();
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Couldn't update trip"
            );
          }
        })
      }
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <PlaneTakeoff className="h-3.5 w-3.5" />
      )}
      Mark in progress
    </Button>
  );
}

export function MarkTripCompletedButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await markTripCompletedAction(tripId);
            toast.success("Trip marked completed");
            router.refresh();
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Couldn't update trip"
            );
          }
        })
      }
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CheckCheck className="h-3.5 w-3.5" />
      )}
      Mark completed
    </Button>
  );
}
