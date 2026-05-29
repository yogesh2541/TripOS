"use client";
import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-[10px] border border-line bg-paper shadow-lift text-ink",
          title: "font-medium text-ink",
          description: "text-muted",
          actionButton: "bg-inkwash text-[var(--on-dark)] rounded-[8px]",
          cancelButton: "bg-paper-2 text-ink rounded-[8px]",
        },
      }}
    />
  );
}
