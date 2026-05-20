"use client";

import { useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Loader2,
  RotateCw,
} from "lucide-react";
import { toast } from "sonner";
import type { WhatsappMessage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MessageStatusPill } from "./message-status-pill";
import { retryWhatsappMessageAction } from "@/server/actions/whatsapp";

export type WhatsappMessageRowData = WhatsappMessage & {
  lead?: { id: string; name: string } | null;
  trip?: { id: string; destination: string } | null;
  invoice?: { id: string; invoiceNumber: string | null } | null;
};

export function WhatsappMessageRow({ m }: { m: WhatsappMessageRowData }) {
  const [isPending, startTransition] = useTransition();
  const outbound = m.direction === "OUTBOUND";

  function retry() {
    startTransition(async () => {
      const res = await retryWhatsappMessageAction(m.id);
      if (res.ok) toast.success("Retried");
      else toast.error(res.error || "Retry failed");
    });
  }

  return (
    <li className="rounded-2xl border border-line bg-white p-4 flex items-start gap-3 hover:shadow-soft transition-all">
      <span
        className={
          "flex h-8 w-8 items-center justify-center rounded-full text-[11px] " +
          (outbound
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : "bg-sand-50 text-sand-800 border border-sand-200")
        }
      >
        {outbound ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5" />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="font-medium text-navy text-sm truncate">
            {m.lead ? (
              <Link
                href={`/leads/${m.lead.id}`}
                className="hover:underline underline-offset-2"
              >
                {m.lead.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Unknown contact</span>
            )}
            <span className="text-muted-foreground"> · </span>
            <span className="text-muted-foreground">{m.phone}</span>
          </p>
          <MessageStatusPill status={m.status} />
          {m.templateName ? (
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {m.templateName}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {formatDistanceToNow(m.createdAt, { addSuffix: true })}
          </span>
        </div>

        <p className="mt-1.5 text-sm text-ink/80 line-clamp-2 whitespace-pre-line">
          {m.message || (
            <span className="italic text-muted-foreground">
              {m.kind === "DOCUMENT" ? "Document attachment" : "—"}
            </span>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          {m.trip ? (
            <Link
              href={`/trips/${m.trip.id}`}
              className="inline-flex items-center gap-1 hover:text-navy"
            >
              <span className="uppercase tracking-[0.16em]">trip</span>
              · {m.trip.destination}
            </Link>
          ) : null}
          {m.invoice ? (
            <Link
              href={`/invoices/${m.invoice.id}`}
              className="inline-flex items-center gap-1 hover:text-navy"
            >
              <FileText className="h-3 w-3" />
              {m.invoice.invoiceNumber ?? "Draft invoice"}
            </Link>
          ) : null}
          {m.mediaUrl ? (
            <a
              href={m.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-navy"
            >
              <FileText className="h-3 w-3" />
              {m.mediaFilename ?? "Attachment"}
            </a>
          ) : null}
          {m.failedReason ? (
            <span className="text-red-700">· {m.failedReason}</span>
          ) : null}
          {outbound && m.status === "FAILED" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] ml-auto"
              onClick={retry}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCw className="h-3 w-3" />
              )}
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
