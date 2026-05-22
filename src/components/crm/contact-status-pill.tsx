"use client";

import { useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LeadStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, LEAD_STATUS_TONE } from "@/lib/crm";
import { updateLeadStatusAction } from "@/server/actions/contacts";

export function LeadStatusPill({
  contactId,
  status,
  editable = true,
}: {
  contactId: string;
  status: LeadStatus;
  editable?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!editable) {
    return (
      <Badge variant={LEAD_STATUS_TONE[status]}>
        {LEAD_STATUS_LABEL[status]}
      </Badge>
    );
  }

  function setStatus(next: LeadStatus) {
    if (next === status) return;
    startTransition(async () => {
      try {
        await updateLeadStatusAction(contactId, next);
        toast.success(`Moved to ${LEAD_STATUS_LABEL[next]}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't update status";
        toast.error(msg);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="focus:outline-none focus-visible:ring-2 focus-visible:ring-sand-300 rounded-full">
        <Badge
          variant={LEAD_STATUS_TONE[status]}
          className="cursor-pointer hover:opacity-90"
        >
          {LEAD_STATUS_LABEL[status]}
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ChevronDown className="h-3 w-3 opacity-70" />
          )}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {LEAD_STATUS_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === status}
            onSelect={() => setStatus(s)}
          >
            <Badge variant={LEAD_STATUS_TONE[s]} className="mr-2">
              {LEAD_STATUS_LABEL[s]}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
