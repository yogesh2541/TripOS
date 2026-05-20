"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelInvoiceAction,
  issueInvoiceAction,
} from "@/server/actions/invoices";
import { sendPaymentReminderAction } from "@/server/actions/whatsapp";
import { ShareOnWhatsappButton } from "@/components/whatsapp/share-on-whatsapp-button";

export function InvoiceActions({
  invoiceId,
  status,
  previewedNumber,
  recipientPhone,
  documentUrl,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  /** Server-computed preview of the next number. Shown in the issue confirmation. */
  previewedNumber: string | null;
  recipientPhone?: string | null;
  documentUrl?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [issueOpen, setIssueOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  function issue() {
    startTransition(async () => {
      try {
        const r = await issueInvoiceAction(invoiceId);
        toast.success(`Issued ${r.invoiceNumber}`);
        setIssueOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't issue");
      }
    });
  }

  function cancel() {
    if (!reason.trim()) {
      toast.error("Add a cancellation reason");
      return;
    }
    startTransition(async () => {
      try {
        await cancelInvoiceAction({ invoiceId, reason: reason.trim() });
        toast.success(
          status === "ISSUED" ? "Invoice cancelled" : "Draft cancelled"
        );
        setCancelOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't cancel");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" ? (
          <>
            <Button onClick={() => setIssueOpen(true)} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4" />
              Issue invoice
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4" />
              Discard draft
            </Button>
          </>
        ) : null}
        {status === "ISSUED" ? (
          <>
            <ShareOnWhatsappButton
              kind="invoice"
              invoiceId={invoiceId}
              documentUrl={documentUrl ?? null}
              recipientPhone={recipientPhone ?? null}
              label="Send on WhatsApp"
              variant="default"
              size="default"
            />
            <ReminderMenu invoiceId={invoiceId} />
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={isPending}
            >
              <XCircle className="h-4 w-4" />
              Cancel invoice
            </Button>
          </>
        ) : null}
      </div>

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue this invoice?</DialogTitle>
            <DialogDescription>
              Issuing locks the invoice number and freezes the recipient and
              supplier details. After issue, edits aren't allowed — only
              cancellation with a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-line bg-ivory p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Will be assigned
            </p>
            <p className="mt-1.5 font-display text-2xl text-navy tracking-wider">
              {previewedNumber ?? "—"}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIssueOpen(false)}
              disabled={isPending}
            >
              Not yet
            </Button>
            <Button onClick={issue} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm & issue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder dropdown handled inline in ReminderMenu — placed below to keep this file self-contained. */}

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {status === "ISSUED"
                ? "Cancel issued invoice"
                : "Discard this draft"}
            </DialogTitle>
            <DialogDescription>
              {status === "ISSUED"
                ? "The invoice will be marked CANCELLED with a reason. The number stays reserved (sequence won't be reused) per GST law."
                : "This draft will be removed from the booking. You can generate a new draft afterward."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              Reason {status === "ISSUED" ? "" : "(optional but recommended)"}
            </Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                status === "ISSUED"
                  ? "e.g. wrong GSTIN — issuing replacement"
                  : "e.g. starting over with new line items"
              }
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={isPending}
            >
              Keep
            </Button>
            <Button
              onClick={cancel}
              disabled={isPending || (status === "ISSUED" && !reason.trim())}
              variant={status === "ISSUED" ? "outline" : "outline"}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {status === "ISSUED" ? "Confirm cancel" : "Discard draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReminderMenu({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function fire(stage: "T_MINUS_3" | "DUE_TODAY" | "OVERDUE_2D") {
    startTransition(async () => {
      const res = await sendPaymentReminderAction({ invoiceId, stage });
      if (res.ok) toast.success("Reminder sent");
      else toast.error(res.error || "Couldn't send reminder");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        Reminder
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send a payment reminder</DialogTitle>
          <DialogDescription>
            Pick the tone — every variant uses your registered template if one
            exists, otherwise the curated seed copy.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button variant="outline" onClick={() => fire("T_MINUS_3")} disabled={isPending}>
            Gentle — 3 days before
          </Button>
          <Button variant="outline" onClick={() => fire("DUE_TODAY")} disabled={isPending}>
            Reminder — due today
          </Button>
          <Button variant="outline" onClick={() => fire("OVERDUE_2D")} disabled={isPending}>
            Help-offered — 2 days overdue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
