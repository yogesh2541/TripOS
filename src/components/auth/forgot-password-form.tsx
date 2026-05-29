"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }
    startTransition(async () => {
      try {
        await requestPasswordResetAction({ email });
        setSent(true);
      } catch {
        toast.error("Something went wrong — try again.");
      }
    });
  }

  if (sent) {
    return (
      <div className="text-center space-y-3">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[10px] bg-ok-soft text-ok border border-ok/20">
          <MailCheck className="h-5 w-5" />
        </span>
        <p className="text-sm text-ink">
          If an account exists for <span className="font-medium">{email}</span>,
          a reset link is on its way. It expires in 1 hour.
        </p>
        <p className="text-xs text-muted">
          Check your spam folder if it doesn&apos;t arrive in a few minutes.
        </p>
        <Link
          href="/login"
          className="inline-block text-xs text-ink underline pt-2"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@agency.com"
          autoFocus
        />
      </div>
      <Button type="submit" variant="accent" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Send reset link
      </Button>
      <p className="text-center text-xs text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-ink underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
