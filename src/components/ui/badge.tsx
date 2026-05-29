import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// "Atelier Pro" status pills — soft tint fills, 6px radius, 11px / 550.
// Variant names are preserved so existing call-sites keep working; the
// look maps onto the design's functional palette.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[6px] h-[21px] px-2 text-[11px] font-[550] tracking-[0.01em] whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "bg-inkwash text-[var(--on-dark)]",
        outline: "border border-line bg-paper text-ink-2",
        accent: "bg-gold-soft text-gold-deep",
        muted: "bg-[#EFEDE6] text-ink-2",
        danger: "bg-bad-soft text-[#9a4234]",
        success: "bg-ok-soft text-[#3c6b48]",
        warn: "bg-warn-soft text-[#8a6418]",
        info: "bg-info-soft text-[#46587a]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
