"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-[13px] font-[550] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-line)] focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:h-[15px] [&_svg]:w-[15px]",
  {
    variants: {
      variant: {
        // navy primary
        default:
          "bg-inkwash text-[var(--on-dark)] shadow-soft hover:bg-inkwash-2",
        // restrained gold gradient — the main CTA only
        accent:
          "bg-gradient-to-br from-gold to-[#B0863F] text-inkwash shadow-[0_2px_10px_rgba(200,169,106,.3)] hover:brightness-[1.04]",
        outline:
          "border border-line bg-paper text-ink hover:border-[var(--gold-line)] hover:bg-paper-2",
        ghost: "text-ink hover:bg-paper-2",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-[15px]",
        sm: "h-[30px] px-[11px] text-xs rounded-[8px]",
        lg: "h-11 px-7 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
