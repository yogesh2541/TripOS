"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type {
  WhatsappAutomationTrigger,
  WhatsappTemplate,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  toggleAutomationRuleAction,
  upsertAutomationRuleAction,
} from "@/server/actions/whatsapp";

export const AUTOMATION_TRIGGER_LABEL: Record<WhatsappAutomationTrigger, string> = {
  QUOTE_SENT_NO_REPLY_24H: "Quote sent — no reply 24h",
  QUOTE_SENT_NO_REPLY_3D: "Quote sent — no reply 3d",
  QUOTE_SENT_NO_REPLY_7D: "Quote sent — no reply 7d",
  PAYMENT_DUE_T_MINUS_3: "Payment due in 3 days",
  PAYMENT_DUE_TODAY: "Payment due today",
  PAYMENT_OVERDUE_2D: "Payment overdue 2 days",
  TRIP_T_MINUS_7: "Trip in 7 days",
  TRIP_T_MINUS_1: "Trip tomorrow",
  TRIP_DEPARTURE_DAY: "Departure day",
  TRIP_COMPLETED_THANKS: "Post-trip thank you",
  INVOICE_ISSUED: "Invoice issued",
};

const TRIGGER_HINT: Record<WhatsappAutomationTrigger, string> = {
  QUOTE_SENT_NO_REPLY_24H: "Nudge prospects who haven't replied within a day.",
  QUOTE_SENT_NO_REPLY_3D: "Second touch when the trail goes cold.",
  QUOTE_SENT_NO_REPLY_7D: "Closing-the-loop message — last attempt.",
  PAYMENT_DUE_T_MINUS_3: "Heads-up before the due date.",
  PAYMENT_DUE_TODAY: "Today is the due date — friendly reminder.",
  PAYMENT_OVERDUE_2D: "Help-offered nudge two days after due.",
  TRIP_T_MINUS_7: "Pre-trip checklist & vouchers a week out.",
  TRIP_T_MINUS_1: "Excitement message the day before.",
  TRIP_DEPARTURE_DAY: "Bon voyage with the 24×7 ops line.",
  TRIP_COMPLETED_THANKS: "Post-trip thank you & review ask.",
  INVOICE_ISSUED: "Auto-share the invoice the moment it's issued.",
};

export function AutomationRuleCard({
  trigger,
  rule,
  templates,
}: {
  trigger: WhatsappAutomationTrigger;
  rule:
    | {
        id: string;
        enabled: boolean;
        delayMinutes: number;
        template: WhatsappTemplate;
      }
    | null;
  templates: WhatsappTemplate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const [templateRowId, setTemplateRowId] = useState<string>(
    rule?.template.id ?? templates[0]?.id ?? ""
  );

  function toggle(next: boolean) {
    setEnabled(next);
    if (!rule) return; // can't toggle until saved
    startTransition(async () => {
      await toggleAutomationRuleAction({ ruleId: rule.id, enabled: next });
      router.refresh();
    });
  }

  function save() {
    if (!templateRowId) {
      toast.error("Pick a template first");
      return;
    }
    startTransition(async () => {
      try {
        await upsertAutomationRuleAction({
          trigger,
          templateRowId,
          enabled,
          delayMinutes: 0,
        });
        toast.success("Saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <li className="rounded-lg border border-line bg-paper p-5 shadow-soft">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0">
          <p className="font-display text-lg text-ink">
            {AUTOMATION_TRIGGER_LABEL[trigger]}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {TRIGGER_HINT[trigger]}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggle(e.target.checked)}
            disabled={isPending && !rule}
            className="h-4 w-4 accent-[var(--gold-line)]"
          />
          <span className="uppercase tracking-[0.18em] text-muted">
            {enabled ? "On" : "Off"}
          </span>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Template
          </span>
          <Select value={templateRowId} onValueChange={setTemplateRowId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>
    </li>
  );
}
