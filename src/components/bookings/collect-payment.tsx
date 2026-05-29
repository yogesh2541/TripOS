"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  CreditCard,
  Link2,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { PaymentLinkStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelPaymentLinkAction,
  createPaymentLinkAction,
} from "@/server/actions/payment-links";
import { formatDate, formatINR } from "@/lib/utils";

export type PaymentLinkView = {
  id: string;
  amount: number;
  status: PaymentLinkStatus;
  shortUrl: string | null;
  createdAt: Date | string;
};

const STATUS_TONE: Record<
  PaymentLinkStatus,
  "outline" | "accent" | "success" | "danger" | "muted"
> = {
  CREATED: "accent",
  PAID: "success",
  CANCELLED: "muted",
  EXPIRED: "muted",
};

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  const e164 = digits.length === 10 ? `91${digits}` : digits;
  if (!e164) return null;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

export function CollectPaymentDialog({
  bookingId,
  pendingAmount,
  configured,
  recipientPhone,
  recipientName,
  destination,
}: {
  bookingId: string;
  pendingAmount: number;
  configured: boolean;
  recipientPhone: string | null;
  recipientName: string | null;
  destination: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(Math.round(pendingAmount) || 0);
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ shortUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset(next: boolean) {
    if (next) {
      setAmount(Math.round(pendingAmount) || 0);
      setCreated(null);
      setCopied(false);
    }
    setOpen(next);
  }

  function submit() {
    if (amount <= 0) {
      toast.error("Enter an amount to collect");
      return;
    }
    startTransition(async () => {
      const res = await createPaymentLinkAction({ bookingId, amount });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCreated({ shortUrl: res.shortUrl });
      toast.success("Payment link ready");
      router.refresh();
    });
  }

  function copy() {
    if (!created) return;
    navigator.clipboard.writeText(created.shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const firstName = recipientName?.trim().split(/\s+/)[0] ?? "there";
  const message = created
    ? `Hi ${firstName}, here's the secure payment link for your ${
        destination ?? "trip"
      }: ${created.shortUrl} (${formatINR(amount)})`
    : "";
  const wa = created ? waLink(recipientPhone, message) : null;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button size="sm" variant="accent">
          <CreditCard className="h-3.5 w-3.5" />
          Collect payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect payment online</DialogTitle>
          <DialogDescription>
            Generate a secure Razorpay link. When the customer pays, it&apos;s
            recorded against this booking automatically.
          </DialogDescription>
        </DialogHeader>

        {!configured ? (
          <div className="rounded-lg border border-[var(--gold-line)] bg-gold-soft p-4 text-sm text-ink">
            Online payments aren&apos;t set up yet. Add your{" "}
            <span className="font-mono text-xs">RAZORPAY_KEY_ID</span> and{" "}
            <span className="font-mono text-xs">RAZORPAY_KEY_SECRET</span> to
            enable payment links, then come back here.
          </div>
        ) : created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-ok/20 bg-ok-soft p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ok mb-2 inline-flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                Payment link · {formatINR(amount)}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={created.shortUrl}
                  className="text-sm font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" size="sm" onClick={copy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener">
                  <Button size="sm" variant="accent">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send on WhatsApp
                  </Button>
                </a>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => reset(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount to collect (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value || 0))}
                autoFocus
              />
              {pendingAmount > 0 && (
                <p className="text-xs text-muted">
                  Balance pending: {formatINR(pendingAmount)}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => reset(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={isPending}>
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PaymentLinksList({
  links,
  recipientPhone,
  recipientName,
  destination,
}: {
  links: PaymentLinkView[];
  recipientPhone: string | null;
  recipientName: string | null;
  destination: string | null;
}) {
  if (links.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
        Payment links ({links.length})
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <PaymentLinkRow
            key={l.id}
            link={l}
            recipientPhone={recipientPhone}
            recipientName={recipientName}
            destination={destination}
          />
        ))}
      </ul>
    </div>
  );
}

function PaymentLinkRow({
  link,
  recipientPhone,
  recipientName,
  destination,
}: {
  link: PaymentLinkView;
  recipientPhone: string | null;
  recipientName: string | null;
  destination: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const firstName = recipientName?.trim().split(/\s+/)[0] ?? "there";
  const message = link.shortUrl
    ? `Hi ${firstName}, here's the secure payment link for your ${
        destination ?? "trip"
      }: ${link.shortUrl} (${formatINR(link.amount)})`
    : "";
  const wa = link.shortUrl ? waLink(recipientPhone, message) : null;
  const live = link.status === "CREATED";

  function copy() {
    if (!link.shortUrl) return;
    navigator.clipboard.writeText(link.shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function cancel() {
    if (!confirm("Cancel this payment link? The customer won't be able to pay it.")) return;
    startTransition(async () => {
      const res = await cancelPaymentLinkAction(link.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Link cancelled");
      router.refresh();
    });
  }

  return (
    <li className="rounded-lg border border-line bg-paper px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink tabular-nums font-mono">
            {formatINR(link.amount)}
          </span>
          <Badge variant={STATUS_TONE[link.status]}>{link.status}</Badge>
        </div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted mt-0.5">
          {formatDate(link.createdAt)}
        </p>
      </div>
      {live && link.shortUrl && (
        <>
          <button
            type="button"
            onClick={copy}
            className="rounded-[6px] p-1.5 text-muted hover:bg-paper-2 hover:text-ink transition-colors"
            aria-label="Copy link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              className="rounded-[6px] p-1.5 text-ok hover:bg-ok-soft transition-colors"
              aria-label="Send on WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="rounded-[6px] p-1.5 text-muted hover:bg-bad-soft hover:text-bad transition-colors disabled:opacity-40"
            aria-label="Cancel link"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </button>
        </>
      )}
    </li>
  );
}
