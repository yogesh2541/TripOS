import {
  ArrowDownLeft,
  Bell,
  FilePen,
  MessageCircle,
  Phone,
  Mail,
  StickyNote,
  RefreshCw,
  Sparkles,
  FileText,
  Send,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Briefcase,
  Flag,
  Handshake,
  PlaneTakeoff,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import type { Activity, ActivityType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

const ICONS: Record<ActivityType, React.ReactNode> = {
  NOTE: <StickyNote className="h-3.5 w-3.5" />,
  CALL: <Phone className="h-3.5 w-3.5" />,
  WHATSAPP: <MessageCircle className="h-3.5 w-3.5" />,
  EMAIL: <Mail className="h-3.5 w-3.5" />,
  STATUS_CHANGED: <RefreshCw className="h-3.5 w-3.5" />,
  TRIP_CREATED: <Sparkles className="h-3.5 w-3.5" />,
  QUOTE_CREATED: <FileText className="h-3.5 w-3.5" />,
  QUOTE_SENT: <Send className="h-3.5 w-3.5" />,
  QUOTE_ACCEPTED: <Check className="h-3.5 w-3.5" />,
  BOOKING_CREATED: <Briefcase className="h-3.5 w-3.5" />,
  PAYMENT_RECORDED: <Wallet className="h-3.5 w-3.5" />,
  CUSTOM: <FilePen className="h-3.5 w-3.5" />,
  VENDOR_ASSIGNED: <Handshake className="h-3.5 w-3.5" />,
  VENDOR_CONFIRMED: <CheckCircle2 className="h-3.5 w-3.5" />,
  VENDOR_CANCELLED: <X className="h-3.5 w-3.5" />,
  VOUCHER_GENERATED: <FileText className="h-3.5 w-3.5" />,
  VOUCHER_SENT: <Send className="h-3.5 w-3.5" />,
  VENDOR_PAYMENT_ADDED: <CircleDollarSign className="h-3.5 w-3.5" />,
  OPS_TASK_CREATED: <ClipboardList className="h-3.5 w-3.5" />,
  OPS_TASK_COMPLETED: <ClipboardCheck className="h-3.5 w-3.5" />,
  TRIP_READY: <Flag className="h-3.5 w-3.5" />,
  TRIP_STARTED: <PlaneTakeoff className="h-3.5 w-3.5" />,
  TRIP_COMPLETED: <Trophy className="h-3.5 w-3.5" />,
  WHATSAPP_INBOUND: <ArrowDownLeft className="h-3.5 w-3.5" />,
  WHATSAPP_OUTBOUND: <MessageCircle className="h-3.5 w-3.5" />,
  QUOTE_SENT_WHATSAPP: <Send className="h-3.5 w-3.5" />,
  INVOICE_SENT_WHATSAPP: <Send className="h-3.5 w-3.5" />,
  PAYMENT_REMINDER_SENT: <Bell className="h-3.5 w-3.5" />,
  FOLLOW_UP_SENT: <Bell className="h-3.5 w-3.5" />,
  TRIP_REMINDER_SENT: <Bell className="h-3.5 w-3.5" />,
  VOUCHER_SENT_WHATSAPP: <Send className="h-3.5 w-3.5" />,
};

export type ActivityWithActor = Activity & {
  actor?: { name: string | null; email: string } | null;
};

export function ActivityItem({ activity }: { activity: ActivityWithActor }) {
  const actorName =
    activity.actor?.name ?? activity.actor?.email ?? null;
  return (
    <article className="flex gap-4">
      <div className="relative">
        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gold-soft border border-[var(--gold-line)] text-gold-deep">
          {ICONS[activity.type]}
        </span>
        <span className="absolute left-1/2 top-8 h-full w-px -translate-x-1/2 bg-line" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-ink text-sm">{activity.title}</p>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted whitespace-nowrap font-mono tabular-nums">
            {actorName ? `${actorName} · ` : ""}
            {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
          </span>
        </div>
        {activity.body && (
          <p className="mt-1 text-sm text-ink/80 whitespace-pre-line leading-relaxed">
            {activity.body}
          </p>
        )}
      </div>
    </article>
  );
}
