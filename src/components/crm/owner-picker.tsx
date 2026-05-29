"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { assignLeadOwnerAction } from "@/server/actions/contacts";
import { assignTripOwnerAction } from "@/server/actions/trips";

type Member = { id: string; name: string };

/**
 * Compact owner / assignee control for contact and trip detail headers.
 * Imports the server actions directly (a Client Component can't receive a
 * plain wrapper function as a prop across the server boundary).
 */
export function OwnerPicker({
  kind,
  entityId,
  currentOwnerId,
  members,
  canAssign,
}: {
  kind: "contact" | "trip";
  entityId: string;
  currentOwnerId: string | null;
  members: Member[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current = members.find((m) => m.id === currentOwnerId) ?? null;
  const label = kind === "contact" ? "Owner" : "Ops owner";

  function set(ownerId: string | null) {
    startTransition(async () => {
      const res =
        kind === "contact"
          ? await assignLeadOwnerAction({ contactId: entityId, ownerId })
          : await assignTripOwnerAction({ tripId: entityId, ownerId });
      if (res.ok) {
        toast.success(ownerId ? "Owner updated" : "Owner cleared");
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't update owner");
      }
    });
  }

  const pill = (
    <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-line bg-paper px-3 py-1.5 text-xs text-ink">
      <UserCircle2 className="h-3.5 w-3.5 text-gold-deep" />
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </span>
      <span className="font-medium">{current?.name ?? "Unassigned"}</span>
      {canAssign ? (
        isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )
      ) : null}
    </span>
  );

  if (!canAssign) return pill;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={isPending}>
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem
          onClick={() => set(null)}
          className="flex items-center justify-between"
        >
          <span className="text-muted-foreground">Unassigned</span>
          {currentOwnerId === null ? <Check className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        {members.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => set(m.id)}
            className="flex items-center justify-between"
          >
            <span>{m.name}</span>
            {m.id === currentOwnerId ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
