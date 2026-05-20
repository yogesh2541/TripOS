"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runAutomationsNowAction } from "@/server/actions/whatsapp";

export function RunAutomationsNowButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function fire() {
    startTransition(async () => {
      try {
        const r = await runAutomationsNowAction();
        if (r.dispatched > 0) {
          toast.success(
            `${r.dispatched} message${r.dispatched === 1 ? "" : "s"} dispatched`
          );
        } else if (r.scanned > 0) {
          toast.info(`Scanned ${r.scanned} candidate${r.scanned === 1 ? "" : "s"} — none due`);
        } else {
          toast.info("Nothing due right now");
        }
        if (r.failed > 0) {
          toast.error(
            `${r.failed} send${r.failed === 1 ? "" : "s"} failed — check Communications`
          );
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't run");
      }
    });
  }

  return (
    <Button variant="outline" onClick={fire} disabled={isPending}>
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      Run now
    </Button>
  );
}
