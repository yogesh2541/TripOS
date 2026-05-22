"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { WhatsappTemplate } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTemplatesAction,
  sendWhatsappTextAction,
} from "@/server/actions/whatsapp";
import { extractTemplateVariables, interpolateTemplate } from "@/lib/whatsapp/templates";
import { formatWhatsappPhoneForDisplay, waMeLink } from "@/lib/whatsapp/phone";

type ComposerLink = {
  contactId?: string | null;
  customerId?: string | null;
  tripId?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
};

type TemplateVariableDef = {
  key: string;
  label: string;
  example?: string;
};

export function WhatsappComposer({
  trigger,
  defaultPhone,
  defaultMessage = "",
  recipientName,
  link,
}: {
  trigger?: React.ReactNode;
  defaultPhone?: string | null;
  defaultMessage?: string;
  recipientName?: string | null;
  link?: ComposerLink;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [body, setBody] = useState(defaultMessage);
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    listTemplatesAction()
      .then((rows) => setTemplates(rows.filter((r) => r.isActive)))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone ?? "");
      setBody(defaultMessage);
      setSelectedTemplateId("");
      setVariables({});
    }
  }, [open, defaultPhone, defaultMessage]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const templateVariables: TemplateVariableDef[] = useMemo(() => {
    if (!selectedTemplate) return [];
    const declared = (selectedTemplate.variables as unknown as TemplateVariableDef[]) ?? [];
    // Defensive — if the template has implicit placeholders not declared in
    // variables[], surface them as plain text-input fields.
    const fromBody = extractTemplateVariables(selectedTemplate.bodyPreview);
    const declaredKeys = new Set(declared.map((d) => d.key));
    const extras: TemplateVariableDef[] = fromBody
      .filter((k) => !declaredKeys.has(k))
      .map((k) => ({ key: k, label: k }));
    return [...declared, ...extras];
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const seed: Record<string, string> = {};
    for (const v of templateVariables) {
      seed[v.key] = (v.example as string | undefined) ?? "";
    }
    if (recipientName) {
      const first = recipientName.trim().split(/\s+/)[0] ?? recipientName;
      if ("name" in seed) seed.name = first;
    }
    setVariables(seed);
    setBody(interpolateTemplate(selectedTemplate.bodyPreview, seed));
  }, [selectedTemplate, recipientName, templateVariables]);

  const renderedBody = useMemo(() => {
    if (!selectedTemplate) return body;
    return interpolateTemplate(selectedTemplate.bodyPreview, variables);
  }, [selectedTemplate, body, variables]);

  function handleSend() {
    if (!phone.trim()) {
      toast.error("Add a phone number");
      return;
    }
    if (!renderedBody.trim()) {
      toast.error("Message is empty");
      return;
    }
    startTransition(async () => {
      const res = await sendWhatsappTextAction({
        toPhone: phone,
        message: renderedBody,
        contactId: link?.contactId ?? null,
        customerId: link?.customerId ?? null,
        tripId: link?.tripId ?? null,
        invoiceId: link?.invoiceId ?? null,
        bookingId: link?.bookingId ?? null,
      });
      if (res.ok) {
        toast.success("Sent — track delivery in Communications");
        setOpen(false);
      } else {
        toast.error(res.error || "Couldn't send");
      }
    });
  }

  const fallbackHref = waMeLink(phone, renderedBody);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            WhatsApp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send on WhatsApp</DialogTitle>
          <DialogDescription>
            Pick a template or write fresh. Preview reflects the final message.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-to">Recipient phone</Label>
              <Input
                id="wa-to"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
              />
              {phone ? (
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {formatWhatsappPhoneForDisplay(phone)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select
                value={selectedTemplateId || "__none__"}
                onValueChange={(v) =>
                  setSelectedTemplateId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingTemplates ? "Loading…" : "Write from scratch"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Write from scratch</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate ? (
              <div className="space-y-2">
                <Label className="block">Variables</Label>
                <div className="space-y-2 max-h-[28vh] overflow-y-auto pr-1">
                  {templateVariables.map((v) => (
                    <div key={v.key}>
                      <Label
                        htmlFor={`wa-var-${v.key}`}
                        className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                      >
                        {v.label}
                      </Label>
                      <Input
                        id={`wa-var-${v.key}`}
                        value={variables[v.key] ?? ""}
                        onChange={(e) =>
                          setVariables((s) => ({ ...s, [v.key]: e.target.value }))
                        }
                        placeholder={v.example}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="wa-body">Message</Label>
                <Textarea
                  id="wa-body"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hi there ✨…"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </Label>
            <motion.div
              key={renderedBody}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="mt-1.5 rounded-2xl border border-line bg-[#E5DDD5] p-3 min-h-[26vh]"
            >
              <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-soft text-[13px] leading-relaxed text-ink whitespace-pre-wrap max-w-[36ch]">
                {renderedBody || (
                  <span className="text-muted-foreground italic">
                    Your message will appear here
                  </span>
                )}
              </div>
            </motion.div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Templates render through Meta when registered. Otherwise the message
              is sent as a regular text — fine for prospects who have replied to
              you in the last 24h.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-4">
          {fallbackHref ? (
            <a
              href={fallbackHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-navy"
            >
              <ExternalLink className="h-3 w-3" />
              Open in WhatsApp Web instead
            </a>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send via API
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
