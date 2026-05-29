"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { MembershipRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteTeamMemberAction } from "@/server/actions/team";

const ROLE_OPTIONS: Array<{ value: MembershipRole; label: string; hint: string }> = [
  {
    value: "STAFF",
    label: "Staff",
    hint: "Manages leads, trips, quotes, invoices, WhatsApp. Can't change billing or team.",
  },
  {
    value: "OWNER",
    label: "Owner",
    hint: "Full control — including team and agency settings. Add carefully.",
  },
  {
    value: "VIEWER",
    label: "Viewer",
    hint: "Read-only. Useful for accountants, auditors, advisors.",
  },
];

export function InviteMemberForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("STAFF");
  const [isPending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Enter an email");
      return;
    }
    startTransition(async () => {
      const res = await inviteTeamMemberAction({ email, role });
      if (res.ok) {
        setInviteUrl(res.inviteUrl ?? null);
        toast.success("Invite created");
        router.refresh();
      } else {
        toast.error(res.error || "Couldn't invite");
      }
    });
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function reset() {
    setEmail("");
    setRole("STAFF");
    setInviteUrl(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4" />
          Invite teammate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to the team</DialogTitle>
          <DialogDescription>
            They'll get a link to set their password and join. You can change
            their role any time.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg bg-ok-soft border border-ok/20 p-4">
              <p className="text-xs text-ok font-medium inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Invite ready — share this link
              </p>
              <p className="mt-2 text-[11px] text-ok/80">
                Email delivery isn't wired yet, so paste this into a WhatsApp
                or email manually. The link is valid for 14 days.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Done
              </Button>
              <Button onClick={reset}>Invite another</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MembershipRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted">
                {ROLE_OPTIONS.find((r) => r.value === role)?.hint}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send invite
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
