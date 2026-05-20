"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Booking,
  BookingStatus,
  InvoiceStatus,
  Payment,
} from "@prisma/client";
import { BookingStatusPill } from "@/components/bookings/booking-status-pill";
import { AddPaymentDialog } from "@/components/bookings/add-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelBookingAction } from "@/server/actions/bookings";
import { deletePaymentAction } from "@/server/actions/payments";
import { createDraftInvoiceAction } from "@/server/actions/invoices";
import { PAYMENT_TYPE_LABEL } from "@/lib/crm";
import { cn, formatDate, formatINR } from "@/lib/utils";

type InvoiceShortcut = {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  grandTotal: number;
} | null;

type Props = {
  booking: Pick<
    Booking,
    "id" | "status" | "totalAmount" | "paidAmount" | "createdAt"
  > & {
    payments: Pick<Payment, "id" | "type" | "amount" | "method" | "reference" | "paidAt">[];
    quoteVersion: number;
    invoice?: InvoiceShortcut;
  };
};

export function BookingPanel({ booking }: Props) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [isCancelling, startCancel] = useTransition();
  const [isGenerating, startGenerate] = useTransition();

  function generateInvoice() {
    startGenerate(async () => {
      try {
        const r = await createDraftInvoiceAction({ bookingId: booking.id });
        toast.success("Draft invoice created");
        router.push(`/invoices/${r.id}`);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn't create invoice"
        );
      }
    });
  }

  const pending = Math.max(0, booking.totalAmount - booking.paidAmount);
  const pct =
    booking.totalAmount > 0
      ? Math.round((booking.paidAmount / booking.totalAmount) * 100)
      : 0;
  const cancelled = booking.status === "CANCELLED";
  const completed = booking.status === "COMPLETED";

  function cancel() {
    if (!confirm("Cancel this booking? Payments are kept for the record.")) {
      return;
    }
    startCancel(async () => {
      try {
        await cancelBookingAction(booking.id);
        toast.success("Booking cancelled");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't cancel");
      }
    });
  }

  return (
    <section
      className={cn(
        "rounded-3xl border p-6 md:p-8 mb-12 transition-colors",
        cancelled
          ? "border-line bg-white/60"
          : completed
            ? "border-emerald-100 bg-emerald-50/40"
            : "border-line bg-white shadow-soft"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sand-700 flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" />
            Booking · v{booking.quoteVersion}
          </p>
          <h2 className="mt-2 font-display text-3xl text-navy">
            {formatINR(booking.totalAmount)}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDate(booking.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BookingStatusPill bookingId={booking.id} status={booking.status as BookingStatus} />
          {!cancelled && (
            <AddPaymentDialog bookingId={booking.id} pendingAmount={pending} />
          )}
          {!cancelled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Cancel booking
            </Button>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>Paid {formatINR(booking.paidAmount)}</span>
          <span>{pct}%</span>
          <span>Pending {formatINR(pending)}</span>
        </div>
        <div className="h-2 w-full bg-ivory rounded-full overflow-hidden border border-line/60">
          <div
            className={cn(
              "h-full transition-all rounded-full",
              cancelled
                ? "bg-line"
                : pct >= 100
                  ? "bg-emerald-500"
                  : "bg-navy"
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>

      {booking.payments.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-navy transition-colors"
          >
            {showHistory ? "Hide" : "Show"} payment history (
            {booking.payments.length})
          </button>
          {showHistory && (
            <ul className="mt-3 space-y-2">
              {booking.payments.map((p) => (
                <PaymentRow key={p.id} payment={p} disabled={cancelled} />
              ))}
            </ul>
          )}
        </div>
      )}

      {pct >= 100 && !completed && !cancelled && (
        <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Fully paid. Mark this booking as completed when the trip wraps.
        </div>
      )}

      {/* Tax invoice */}
      <div className="mt-5 rounded-2xl border border-line bg-ivory/60 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-line text-sand-700">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Tax invoice
            </p>
            {booking.invoice ? (
              <p className="text-sm text-navy mt-0.5 truncate">
                {booking.invoice.invoiceNumber ?? "Draft"}
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatINR(booking.invoice.grandTotal)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                Not generated yet
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {booking.invoice ? (
            <>
              <Badge
                variant={
                  booking.invoice.status === "ISSUED"
                    ? "success"
                    : booking.invoice.status === "CANCELLED"
                      ? "danger"
                      : "outline"
                }
              >
                {booking.invoice.status}
              </Badge>
              <Link href={`/invoices/${booking.invoice.id}`}>
                <Button size="sm" variant="outline">
                  Open invoice
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          ) : (
            !cancelled && (
              <Button
                size="sm"
                onClick={generateInvoice}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Generate tax invoice
              </Button>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function PaymentRow({
  payment,
  disabled,
}: {
  payment: Pick<Payment, "id" | "type" | "amount" | "method" | "reference" | "paidAt">;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm("Delete this payment?")) return;
    startTransition(async () => {
      try {
        await deletePaymentAction(payment.id);
        toast.success("Payment deleted");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-white px-4 py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-sand-700">
            {PAYMENT_TYPE_LABEL[payment.type]}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(payment.paidAt)}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-ink truncate">
          {payment.method ? `via ${payment.method}` : "—"}
          {payment.reference && (
            <span className="text-muted-foreground">
              {" · "}
              {payment.reference}
            </span>
          )}
        </p>
      </div>
      <span className="font-medium text-navy tabular-nums">
        {formatINR(payment.amount)}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-30"
          aria-label="Delete payment"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
