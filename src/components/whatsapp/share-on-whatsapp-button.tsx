"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  shareInvoiceWhatsappAction,
  shareProposalWhatsappAction,
} from "@/server/actions/whatsapp";
import { waMeLink } from "@/lib/whatsapp/phone";

type Variant = "default" | "outline" | "ghost" | "accent";

type CommonProps = {
  recipientPhone?: string | null;
  fallbackMessage?: string;
  label?: string;
  variant?: Variant;
  size?: "sm" | "default";
};

type ProposalProps = CommonProps & {
  kind: "proposal";
  tripId: string;
  quoteId: string;
};

type InvoiceProps = CommonProps & {
  kind: "invoice";
  invoiceId: string;
  documentUrl?: string | null;
};

type Props = ProposalProps | InvoiceProps;

/**
 * Two-step share: primary action sends via Cloud API; if the phone is
 * present, we also surface a `wa.me` fallback link so the operator can
 * push from their phone if the API isn't configured yet.
 */
export function ShareOnWhatsappButton(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [justSent, setJustSent] = useState(false);

  function fire() {
    startTransition(async () => {
      try {
        const res =
          props.kind === "proposal"
            ? await shareProposalWhatsappAction({
                tripId: props.tripId,
                quoteId: props.quoteId,
              })
            : await shareInvoiceWhatsappAction({
                invoiceId: props.invoiceId,
                documentUrl: props.documentUrl ?? undefined,
              });
        if (res.ok) {
          toast.success(
            props.kind === "proposal"
              ? "Proposal sent on WhatsApp"
              : "Invoice sent on WhatsApp"
          );
          setJustSent(true);
          setTimeout(() => setJustSent(false), 2500);
          router.refresh();
        } else {
          toast.error(res.error || "WhatsApp send failed");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't send");
      }
    });
  }

  const fallback = waMeLink(props.recipientPhone, props.fallbackMessage);

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant={props.variant ?? "outline"}
        size={props.size ?? "sm"}
        onClick={fire}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : justSent ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
        )}
        {justSent ? "Sent" : (props.label ?? "Share on WhatsApp")}
      </Button>
      {fallback ? (
        <a
          href={fallback}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-navy"
        >
          <ExternalLink className="h-3 w-3" />
          wa.me
        </a>
      ) : null}
    </div>
  );
}
