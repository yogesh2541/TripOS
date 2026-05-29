"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  ActivityItem,
  type ActivityWithActor,
} from "@/components/crm/activity-item";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction } from "@/server/actions/activities";

export function LeadTimeline({
  contactId,
  activities,
}: {
  contactId: string;
  activities: ActivityWithActor[];
}) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const body = note.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        await addNoteAction({ contactId, body });
        setNote("");
        toast.success("Note added");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't save note";
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-paper p-4">
        <Textarea
          rows={2}
          placeholder="Add a note about this contact…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 py-1"
        />
        <div className="flex items-center justify-end pt-2">
          <Button
            size="sm"
            onClick={submit}
            disabled={isPending || note.trim().length === 0}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Add note
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-paper-2 p-12 text-center">
          <p className="text-sm text-muted">
            No activity yet. Add a note, log a call, or move the contact through
            the pipeline.
          </p>
        </div>
      ) : (
        <div className="pl-1">
          {activities.map((a, i) => (
            <div key={a.id} className={i === activities.length - 1 ? "[&>article>div:first-child>span:last-child]:hidden" : ""}>
              <ActivityItem activity={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
