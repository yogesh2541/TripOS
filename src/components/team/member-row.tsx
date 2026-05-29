"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeMemberAction, setMemberRoleAction } from "@/server/actions/team";

const ROLES: MembershipRole[] = ["OWNER", "STAFF", "VIEWER"];

const ROLE_TONE: Record<MembershipRole, "accent" | "outline" | "muted"> = {
  OWNER: "accent",
  STAFF: "outline",
  VIEWER: "muted",
};

export function MemberRow({
  membership,
  isSelf,
  ownerCount,
}: {
  membership: {
    id: string;
    role: MembershipRole;
    suspendedAt: Date | null;
    userId: string;
    user: { name: string | null; email: string; image: string | null };
    createdAt: Date;
  };
  isSelf: boolean;
  ownerCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeRole(role: MembershipRole) {
    if (role === membership.role) return;
    startTransition(async () => {
      const res = await setMemberRoleAction({
        membershipId: membership.id,
        role,
      });
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't update role");
      }
    });
  }

  function remove() {
    if (
      !confirm(
        `Remove ${membership.user.name ?? membership.user.email} from the team?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await removeMemberAction(membership.id);
      if (res.ok) {
        toast.success("Member removed");
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't remove");
      }
    });
  }

  const initials = (membership.user.name ?? membership.user.email)
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const canDemoteSelf =
    !isSelf || membership.role !== "OWNER" || ownerCount > 1;

  return (
    <li className="rounded-lg border border-line bg-paper px-4 py-3 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inkwash text-[var(--on-dark)] text-xs font-medium shrink-0">
        {initials}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink text-sm truncate">
          {membership.user.name ?? membership.user.email}
          {isSelf ? (
            <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-muted">
              You
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted truncate">
          {membership.user.email}
        </p>
      </div>

      <Select
        value={membership.role}
        onValueChange={(v) => changeRole(v as MembershipRole)}
        disabled={isPending || (!canDemoteSelf && membership.role === "OWNER")}
      >
        <SelectTrigger className="w-32 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Badge variant={ROLE_TONE[membership.role]} className="hidden sm:inline-flex">
        {membership.role}
      </Badge>

      <Button
        variant="ghost"
        size="sm"
        onClick={remove}
        disabled={isPending || isSelf}
        title={isSelf ? "Can't remove yourself" : "Remove member"}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </li>
  );
}
