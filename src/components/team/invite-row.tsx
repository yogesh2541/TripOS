"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type { MembershipRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { revokeInviteAction } from "@/server/actions/team";

const ROLE_TONE: Record<MembershipRole, "accent" | "outline" | "muted"> = {
  OWNER: "accent",
  STAFF: "outline",
  VIEWER: "muted",
};

function inviteUrl(token: string) {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/accept-invite/${token}`;
}

export function InviteRow({
  invite,
}: {
  invite: {
    id: string;
    email: string;
    role: MembershipRole;
    token: string;
    expiresAt: Date;
    invitedByName: string | null;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(inviteUrl(invite.token)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function revoke() {
    if (!confirm(`Revoke the invite to ${invite.email}?`)) return;
    startTransition(async () => {
      const res = await revokeInviteAction(invite.id);
      if (res.ok) {
        toast.success("Invite revoked");
        router.refresh();
      } else {
        toast.error("Couldn't revoke");
      }
    });
  }

  return (
    <li className="rounded-lg border border-line bg-paper px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink text-sm truncate">{invite.email}</p>
        <p className="text-xs text-muted truncate">
          Invited by {invite.invitedByName ?? "—"} ·{" "}
          {formatDistanceToNow(invite.expiresAt, { addSuffix: true })} to accept
        </p>
      </div>

      <Badge variant={ROLE_TONE[invite.role]}>{invite.role}</Badge>

      <Button variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>

      <Button variant="ghost" size="sm" onClick={revoke} disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
      </Button>
    </li>
  );
}
