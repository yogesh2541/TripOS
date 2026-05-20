"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteVendorPaymentAction,
  restoreVendorPaymentAction,
} from "@/server/actions/vendor-payments";

export function VendorPaymentRowActions({
  paymentId,
  amount,
}: {
  paymentId: string;
  amount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        const r = await deleteVendorPaymentAction(paymentId);
        const snap = r.snapshot;
        toast.success(
          `Deleted ₹${Math.round(amount).toLocaleString("en-IN")} payment`,
          {
            duration: 6000,
            action: {
              label: "Undo",
              onClick: () => {
                startTransition(async () => {
                  try {
                    await restoreVendorPaymentAction(snap);
                    toast.success("Payment restored");
                    router.refresh();
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Couldn't restore"
                    );
                  }
                });
              },
            },
          }
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={isPending}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="Delete payment"
      aria-label="Delete payment"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
