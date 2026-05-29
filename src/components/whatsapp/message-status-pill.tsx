import { Check, CheckCheck, Clock, Eye, AlertCircle } from "lucide-react";
import type { WhatsappStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const META: Record<
  WhatsappStatus,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  QUEUED: {
    label: "Queued",
    icon: <Clock className="h-3 w-3" />,
    tone: "bg-paper-2 text-muted border border-line",
  },
  SENT: {
    label: "Sent",
    icon: <Check className="h-3 w-3" />,
    tone: "bg-paper text-ink border border-line",
  },
  DELIVERED: {
    label: "Delivered",
    icon: <CheckCheck className="h-3 w-3" />,
    tone: "bg-ok-soft text-ok border border-ok/30",
  },
  READ: {
    label: "Read",
    icon: <Eye className="h-3 w-3" />,
    tone: "bg-ok-soft text-ok border border-ok/30",
  },
  FAILED: {
    label: "Failed",
    icon: <AlertCircle className="h-3 w-3" />,
    tone: "bg-bad-soft text-bad border border-bad/30",
  },
};

export function MessageStatusPill({
  status,
  className,
}: {
  status: WhatsappStatus;
  className?: string;
}) {
  const m = META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        m.tone,
        className
      )}
    >
      {m.icon}
      {m.label}
    </span>
  );
}
