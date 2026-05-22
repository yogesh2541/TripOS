"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { mailtoLink, telLink } from "@/lib/crm";
import { logCallAction } from "@/server/actions/activities";
import { WhatsappComposer } from "@/components/whatsapp/whatsapp-composer";

export function ContactStrip({
  contactId,
  leadName,
  phone,
  email,
}: {
  contactId: string;
  leadName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const tel = telLink(phone);
  const mail = mailtoLink(email);

  return (
    <div className="flex items-center gap-2">
      {tel && (
        <a href={tel} onClick={() => logCallAction({ contactId, body: null })}>
          <IconButton title={phone ?? "Call"}>
            <Phone className="h-3.5 w-3.5" />
          </IconButton>
        </a>
      )}
      {phone ? (
        <WhatsappComposer
          defaultPhone={phone}
          recipientName={leadName}
          link={{ contactId }}
          trigger={
            <button
              type="button"
              title="WhatsApp"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-emerald-700 hover:border-emerald-200 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
          }
        />
      ) : null}
      {mail && (
        <a href={mail}>
          <IconButton title={email ?? "Email"}>
            <Mail className="h-3.5 w-3.5" />
          </IconButton>
        </a>
      )}
    </div>
  );
}

function IconButton({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-navy hover:border-sand transition-colors"
    >
      {children}
    </span>
  );
}
