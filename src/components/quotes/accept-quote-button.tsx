"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptQuoteByTokenAction } from "@/server/actions/quotes";

export function AcceptQuoteButton({
  token,
  alreadyAccepted,
  agencyName,
}: {
  token: string;
  alreadyAccepted: boolean;
  agencyName?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(alreadyAccepted);

  function accept() {
    startTransition(async () => {
      const res = await acceptQuoteByTokenAction(token);
      if (res.ok) {
        setAccepted(true);
        toast.success("Quote accepted ✨");
      } else {
        toast.error(res.error || "Couldn't accept");
      }
    });
  }

  return (
    <AnimatePresence mode="wait">
      {accepted ? (
        <motion.div
          key="accepted"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-lg bg-ok-soft border border-ok/20 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[6px] bg-ok text-[var(--on-dark)] shadow-soft"
          >
            <Check className="h-7 w-7" strokeWidth={3} />
          </motion.div>
          <p className="font-display text-2xl text-ink">
            You're going on this trip ✨
          </p>
          <p className="mt-2 text-sm text-muted">
            {agencyName ?? "Your travel team"} will reach out shortly with
            payment details and next steps.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="cta"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg bg-inkwash text-[var(--on-dark)] p-6 md:p-8 text-center shadow-lift"
        >
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--on-dark)]/70 inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Ready when you are
          </p>
          <h3 className="mt-2 font-display text-2xl md:text-3xl">
            Accept this proposal
          </h3>
          <p className="mt-2 text-sm text-[var(--on-dark)]/80 max-w-md mx-auto">
            One tap and we'll lock in your dates. Your travel team will follow
            up over WhatsApp with payment and the booking confirmations.
          </p>
          <Button
            variant="accent"
            size="lg"
            onClick={accept}
            disabled={isPending}
            className="mt-5 min-w-[220px]"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Accept this proposal
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
