import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[9px] border border-line bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-muted transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-line)] focus-visible:border-[var(--gold-line)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
