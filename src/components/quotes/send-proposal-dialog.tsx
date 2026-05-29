"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  Copy,
  Check,
  Link2,
  Mail,
  MessageCircle,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShareOnWhatsappButton } from "@/components/whatsapp/share-on-whatsapp-button";
import { addDays, cn, formatINR } from "@/lib/utils";

type Channel = "whatsapp" | "email" | "link";

// The "stronger send/share flow" — one focused surface to compose and send a
// proposal. WhatsApp send reuses the existing ShareOnWhatsappButton (Cloud
// API + wa.me fallback); Email opens a mailto; Link-only copies the share URL.
export function SendProposalDialog({
  trigger,
  tripId,
  quoteId,
  recipientName,
  recipientPhone,
  recipientEmail,
  destination,
  agencyName = "Your agency",
  total,
  perPerson,
  version,
  dateRange,
  validityDays = 14,
  preparedAt,
  shareToken,
}: {
  trigger: React.ReactNode;
  tripId: string;
  quoteId: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  destination?: string | null;
  agencyName?: string;
  total?: number | null;
  perPerson?: number | null;
  version?: number | null;
  dateRange?: string | null;
  validityDays?: number;
  preparedAt?: string | null;
  shareToken?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [attachPdf, setAttachPdf] = useState(true);
  const [copied, setCopied] = useState(false);

  const firstName = recipientName?.trim().split(/\s+/)[0] ?? "there";
  const dest = destination ?? "your trip";

  const [message, setMessage] = useState(
    `Hi ${firstName} — your ${dest} proposal is ready ✨ ${
      version ? `(v${version}) ` : ""
    }Everything we discussed, in one place. Tap below to view, and tell us what you'd love to tweak.`
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return shareToken ? `/p/${shareToken}` : `/trips/${tripId}/preview`;
    }
    return shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : `${window.location.origin}/trips/${tripId}/preview`;
  }, [shareToken, tripId]);

  const validUntil = preparedAt
    ? addDays(new Date(preparedAt), validityDays).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const mailtoHref = `mailto:${recipientEmail ?? ""}?subject=${encodeURIComponent(
    `Your ${dest} proposal${version ? ` · v${version}` : ""}`
  )}&body=${encodeURIComponent(`${message}\n\n${shareUrl}`)}`;

  const CHANNELS: { id: Channel; label: string; icon: React.ReactNode }[] = [
    { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="h-[19px] w-[19px]" /> },
    { id: "email", label: "Email", icon: <Mail className="h-[19px] w-[19px]" /> },
    { id: "link", label: "Link only", icon: <Link2 className="h-[19px] w-[19px]" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {/* header */}
        <div className="px-6 pt-6 pb-4 border-b border-line">
          <p className="tc-eyebrow gold">Send proposal</p>
          <h3 className="font-display text-2xl text-ink mt-1">
            {dest}
            {recipientName ? ` · ${recipientName}` : ""}
          </h3>
        </div>

        <div className="grid md:grid-cols-2">
          {/* left — compose */}
          <div className="p-6 md:border-r border-line space-y-5">
            <div>
              <p className="tc-stat-label mb-2.5">Channel</p>
              <div className="flex gap-2">
                {CHANNELS.map((c) => {
                  const on = channel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id)}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1.5 rounded-[11px] border px-2 py-3.5 transition-colors",
                        on
                          ? "border-inkwash bg-inkwash text-white [&_svg]:text-gold"
                          : "border-line bg-paper text-ink-2 [&_svg]:text-muted hover:border-[var(--gold-line)]"
                      )}
                    >
                      {c.icon}
                      <span className="text-[11.5px] font-medium">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink-2 block mb-1.5">
                Recipient
              </label>
              <div className="flex items-center gap-2 h-10 rounded-[9px] border border-line bg-paper px-3 text-sm text-ink">
                <Users className="h-[15px] w-[15px] text-muted" />
                {recipientName ?? "Traveller"}
                {recipientPhone ? (
                  <span className="text-muted font-mono text-xs">
                    · {recipientPhone}
                  </span>
                ) : recipientEmail && channel === "email" ? (
                  <span className="text-muted text-xs">· {recipientEmail}</span>
                ) : null}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-ink-2 block mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-ink-2 focus:outline-none focus:border-[var(--gold-line)] focus:ring-2 focus:ring-[var(--gold-line)] resize-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setAttachPdf((v) => !v)}
              className="w-full flex items-center justify-between rounded-[10px] border border-line bg-paper px-3.5 py-3 text-left"
            >
              <span>
                <span className="block text-[13px] font-medium text-ink">
                  Attach PDF proposal
                </span>
                <span className="block text-[11px] text-muted mt-0.5">
                  A4 document
                  {total ? ` · ${formatINR(total)}` : ""} · 6 pages
                </span>
              </span>
              <span
                className={cn(
                  "relative h-[22px] w-[38px] rounded-full transition-colors flex-none",
                  attachPdf ? "bg-inkwash" : "bg-line"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all",
                    attachPdf ? "right-0.5" : "left-0.5"
                  )}
                />
              </span>
            </button>

            <div>
              <label className="text-[11px] font-medium text-ink-2 block mb-1.5">
                Quote valid for
              </label>
              <div className="flex items-center gap-2 h-10 rounded-[9px] border border-line bg-paper px-3 text-sm text-ink">
                <Clock className="h-[15px] w-[15px] text-muted" />
                <span className="font-mono tabular-nums">{validityDays}</span> days
                {validUntil ? (
                  <span className="text-muted text-xs">· until {validUntil}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* right — preview */}
          <div className="p-6 bg-paper-2 space-y-3">
            <p className="tc-stat-label">
              {channel === "whatsapp"
                ? "WhatsApp preview"
                : channel === "email"
                  ? "Email preview"
                  : "Share link"}
            </p>
            {channel === "link" ? (
              <div className="rounded-[12px] border border-line bg-paper p-4">
                <p className="text-sm text-ink-2 leading-relaxed">
                  Anyone with this link can view the live proposal. It updates
                  as you edit.
                </p>
                <div className="mt-3 flex items-center gap-2 rounded-[9px] border border-line bg-paper-2 px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 text-muted shrink-0" />
                  <span className="flex-1 font-mono text-[11.5px] text-ink-2 truncate">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="tc-btn tc-btn-ghost tc-btn-sm"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[16px] bg-[#E5DDD3] border border-line p-4">
                <div className="max-w-[92%] rounded-[4px_12px_12px_12px] bg-white p-3 shadow-sm">
                  <p className="text-[12.5px] leading-snug text-[#111] whitespace-pre-line">
                    {message}
                  </p>
                  <div className="mt-2.5 rounded-[9px] border border-[#e2e2e2] overflow-hidden">
                    <div className="relative h-24 bg-inkwash">
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(circle at 80% 20%, rgba(200,169,106,.4), transparent), linear-gradient(180deg, rgba(8,16,24,.2), rgba(8,16,24,.85))",
                        }}
                      />
                      <div className="absolute left-3 bottom-2 font-display text-2xl leading-none text-white">
                        {dest}
                      </div>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[12px] font-semibold text-[#111]">
                        {dest} — {agencyName}
                      </p>
                      <p className="text-[10.5px] text-[#667] mt-0.5">
                        {dateRange ? `${dateRange} · ` : ""}
                        {perPerson ? `from ${formatINR(perPerson)} pp` : ""}
                      </p>
                      <p className="text-[9.5px] text-[#8a94a6] mt-1.5 font-mono truncate">
                        {shareUrl.replace(/^https?:\/\//, "")}
                      </p>
                    </div>
                  </div>
                  <div className="text-[9px] text-[#8a94a6] text-right mt-1 font-mono">
                    ✓✓
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-line flex flex-wrap items-center justify-between gap-3 bg-paper">
          <span className="text-[11px] text-muted">
            Sent from {agencyName} · WhatsApp Business
          </span>
          <div className="flex items-center gap-2.5">
            {channel === "whatsapp" ? (
              <ShareOnWhatsappButton
                kind="proposal"
                tripId={tripId}
                quoteId={quoteId}
                recipientPhone={recipientPhone ?? null}
                fallbackMessage={message}
                label="Send proposal"
                variant="accent"
              />
            ) : channel === "email" ? (
              <a href={mailtoHref}>
                <button className="tc-btn tc-btn-gold">
                  <Mail className="h-[15px] w-[15px]" />
                  Send proposal
                </button>
              </a>
            ) : (
              <button
                type="button"
                onClick={copyLink}
                className="tc-btn tc-btn-gold"
              >
                {copied ? (
                  <Check className="h-[15px] w-[15px]" />
                ) : (
                  <Copy className="h-[15px] w-[15px]" />
                )}
                {copied ? "Link copied" : "Copy share link"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
