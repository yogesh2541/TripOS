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
    tone: "bg-ivory text-muted-foreground border border-line",
  },
  SENT: {
    label: "Sent",
    icon: <Check className="h-3 w-3" />,
    tone: "bg-white text-navy border border-line",
  },
  DELIVERED: {
    label: "Delivered",
    icon: <CheckCheck className="h-3 w-3" />,
    tone: "bg-sand-50 text-sand-800 border border-sand-200",
  },
  READ: {
    label: "Read",
    icon: <Eye className="h-3 w-3" />,
    tone: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  FAILED: {
    label: "Failed",
    icon: <AlertCircle className="h-3 w-3" />,
    tone: "bg-red-50 text-red-700 border border-red-100",
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        m.tone,
        className
      )}
    >
      {m.icon}
      {m.label}
    </span>
  );
}
