"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

// Brief, celebratory full-screen flash — used for milestone moments like
// quote accepted, booking confirmed, invoice issued, trip completed.
// Auto-dismisses after `durationMs`. Rendered into document.body via portal
// so it sits above sticky headers and dialogs.

export function SuccessFlash({
  open,
  onClose,
  title,
  body,
  icon = "sparkle",
  durationMs = 2000,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: "sparkle" | "check";
  durationMs?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, onClose, durationMs]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
        >
          {/* Sparkle particles — pure CSS rings radiating outwards */}
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, opacity: 0.6 }}
                animate={{ scale: 6 + i, opacity: 0 }}
                transition={{
                  duration: 1.2,
                  delay: i * 0.12,
                  ease: "easeOut",
                }}
                className="absolute h-32 w-32 rounded-full border border-[var(--gold-line)]"
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.6, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative rounded-xl border border-line bg-paper shadow-lift px-8 py-7 text-center max-w-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.05 }}
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ok text-white shadow-soft"
            >
              {icon === "check" ? (
                <Check className="h-6 w-6" strokeWidth={3} />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </motion.div>
            <p className="font-display text-2xl text-ink">{title}</p>
            {body ? (
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
