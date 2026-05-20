"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addVendorNoteAction } from "@/server/actions/vendors";

export function VendorNotesForm({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await addVendorNoteAction({ vendorId, body: trimmed });
        setBody("");
        toast.success("Note added");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't add note");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add an operational note about this vendor…"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={submit}
          disabled={isPending || !body.trim()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add note
        </Button>
      </div>
    </div>
  );
}
