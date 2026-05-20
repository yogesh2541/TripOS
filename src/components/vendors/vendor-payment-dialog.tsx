"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createVendorPaymentAction,
  type VendorPaymentInput,
} from "@/server/actions/vendor-payments";
import { VENDOR_PAYMENT_MODE_LABEL } from "@/lib/crm";

const MODES = ["BANK", "UPI", "CASH", "CARD", "OTHER"] as const;

export function VendorPaymentDialog({
  vendorId,
  vendorName,
  trigger,
  trips,
}: {
  vendorId: string;
  vendorName: string;
  trigger?: React.ReactNode;
  trips?: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<VendorPaymentInput>({
    vendorId,
    tripId: null,
    bookingId: null,
    amount: 0,
    paymentDate: today,
    mode: "BANK",
    reference: "",
    notes: "",
  });

  function update<K extends keyof VendorPaymentInput>(
    key: K,
    value: VendorPaymentInput[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.amount || form.amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    startTransition(async () => {
      try {
        await createVendorPaymentAction(form);
        toast.success("Payment recorded");
        setOpen(false);
        setForm({
          vendorId,
          tripId: null,
          bookingId: null,
          amount: 0,
          paymentDate: today,
          mode: "BANK",
          reference: "",
          notes: "",
        });
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't record payment");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-3.5 w-3.5" />
            Record payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record vendor payment</DialogTitle>
          <DialogDescription>
            Pay-out to {vendorName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vp-amount">Amount (₹)</Label>
              <Input
                id="vp-amount"
                type="number"
                min={0}
                value={form.amount === 0 ? "" : String(form.amount)}
                onChange={(e) =>
                  update(
                    "amount",
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-date">Date</Label>
              <Input
                id="vp-date"
                type="date"
                value={form.paymentDate}
                onChange={(e) => update("paymentDate", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) =>
                update("mode", v as VendorPaymentInput["mode"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {VENDOR_PAYMENT_MODE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {trips && trips.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Trip (optional)</Label>
              <Select
                value={form.tripId ?? "__none"}
                onValueChange={(v) =>
                  update("tripId", v === "__none" ? null : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not tied to a trip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not tied to a trip —</SelectItem>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="vp-ref">Reference</Label>
            <Input
              id="vp-ref"
              value={form.reference ?? ""}
              onChange={(e) => update("reference", e.target.value)}
              placeholder="UTR / cheque #"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vp-notes">Notes</Label>
            <Textarea
              id="vp-notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !form.amount || form.amount <= 0}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
