"use client";

import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import type { WhatsappMessage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MessageStatusPill } from "./message-status-pill";
import { retryWhatsappMessageAction } from "@/server/actions/whatsapp";

export function WhatsappThread({
  messages,
}: {
  messages: Array<
    Pick<
      WhatsappMessage,
      | "id"
      | "direction"
      | "status"
      | "message"
      | "templateName"
      | "phone"
      | "createdAt"
      | "sentAt"
      | "deliveredAt"
      | "readAt"
      | "failedReason"
      | "mediaUrl"
      | "mediaFilename"
      | "kind"
    >
  >;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-center text-sm text-muted-foreground">
        No WhatsApp messages yet.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-[#E5DDD5] p-4">
      <ul className="space-y-2.5">
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({
  m,
}: {
  m: Parameters<typeof WhatsappThread>[0]["messages"][number];
}) {
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
    <li className={outbound ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[78%]">
        <div
          className={
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-soft whitespace-pre-wrap " +
            (outbound
              ? "bg-[#DCF8C6] text-ink rounded-br-md"
              : "bg-white text-ink rounded-bl-md")
          }
        >
          {m.kind === "DOCUMENT" && m.mediaUrl ? (
            <a
              href={m.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline decoration-dotted underline-offset-2"
            >
              📎 {m.mediaFilename ?? "Document"}
            </a>
          ) : null}
          {m.message ? <p>{m.message}</p> : null}
        </div>
        <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">
          <span>{formatDistanceToNow(m.createdAt, { addSuffix: true })}</span>
          {outbound ? <MessageStatusPill status={m.status} /> : null}
          {m.templateName ? (
            <span className="uppercase tracking-[0.16em]">
              · {m.templateName}
            </span>
          ) : null}
          {outbound && m.status === "FAILED" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
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
        {outbound && m.status === "FAILED" && m.failedReason ? (
          <p className="mt-1 px-1 text-[10px] text-red-700">{m.failedReason}</p>
        ) : null}
      </div>
    </li>
  );
}
