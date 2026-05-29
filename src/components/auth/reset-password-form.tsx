"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    startTransition(async () => {
      try {
        const res = await resetPasswordAction({ token, password });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setDone(true);
        setTimeout(() => router.push("/login"), 1800);
      } catch {
        toast.error("Something went wrong — try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[10px] bg-ok-soft text-ok border border-ok/20">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <p className="text-sm text-ink">
          Password updated. Taking you to sign in…
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-ink">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-xs text-ink underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Set new password
      </Button>
      <p className="text-center text-xs text-muted">
        <Link href="/login" className="text-ink underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
