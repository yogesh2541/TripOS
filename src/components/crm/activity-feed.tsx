import Link from "next/link";
import {
  ArrowDownLeft,
  Bell,
  Briefcase,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FilePen,
  FileText,
  Flag,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  PlaneTakeoff,
  RefreshCw,
  Send,
  Sparkles,
  StickyNote,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Activity, ActivityType } from "@prisma/client";

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

export type ActivityFeedItem = Activity & {
  contact: { id: string; name: string };
};

export function ActivityFeed({ activities }: { activities: ActivityFeedItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-paper-2 p-8 text-center text-sm text-muted-foreground">
        No activity yet. Pipeline events show up here.
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {activities.map((a) => (
        <li key={a.id}>
          <Link
            href={`/contacts/${a.contact.id}`}
            className="group flex items-start gap-3 rounded-lg border border-line bg-paper p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-[var(--gold-line)] hover:shadow-lift"
          >
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[8px] border border-line bg-paper-2 text-gold-deep">
              {ICONS[a.type]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-ink">
                  {a.title}
                </p>
                <span className="whitespace-nowrap font-mono text-[11px] text-faint">
                  {formatDistanceToNow(a.createdAt, { addSuffix: true })}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {a.contact.name}
              </p>
              {a.body && (
                <p className="mt-2 line-clamp-2 text-sm text-ink-2">
                  {a.body}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
