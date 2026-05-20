"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getOrCreateDemoUser } from "@/lib/prisma";
import { retryFailedMessage } from "@/lib/whatsapp";
import { normalizeWhatsappPhone } from "@/lib/whatsapp/phone";
import {
  listAutomationRules,
  listTemplates,
  sendFollowUp,
  sendManualText,
  sendPaymentReminder,
  sendTripReminder,
  sendVoucherOnWhatsapp,
  setAutomationRuleEnabled,
  shareInvoiceOnWhatsapp,
  shareProposalOnWhatsapp,
  upsertAutomationRule,
  upsertTemplate,
} from "@/server/services/whatsapp";

const AUTOMATION_TRIGGERS = [
  "QUOTE_SENT_NO_REPLY_24H",
  "QUOTE_SENT_NO_REPLY_3D",
  "QUOTE_SENT_NO_REPLY_7D",
  "PAYMENT_DUE_T_MINUS_3",
  "PAYMENT_DUE_TODAY",
  "PAYMENT_OVERDUE_2D",
  "TRIP_T_MINUS_7",
  "TRIP_T_MINUS_1",
  "TRIP_DEPARTURE_DAY",
  "TRIP_COMPLETED_THANKS",
  "INVOICE_ISSUED",
] as const;

const TEMPLATE_CATEGORIES = [
  "PROPOSAL",
  "INVOICE",
  "PAYMENT_REMINDER",
  "FOLLOW_UP",
  "TRIP_REMINDER",
  "OPERATIONS",
  "UTILITY",
  "MARKETING",
  "CUSTOM",
] as const;

// === Manual send ===

const manualSendSchema = z.object({
  toPhone: z.string().min(4),
  message: z.string().min(1).max(4000),
  leadId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  tripId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  bookingId: z.string().nullable().optional(),
});

export async function sendWhatsappTextAction(input: z.infer<typeof manualSendSchema>) {
  const data = manualSendSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const normalized = normalizeWhatsappPhone(data.toPhone);
  if (!normalized) {
    return { ok: false as const, error: "Phone number looks invalid" };
  }

  const result = await sendManualText({
    userId: user.id,
    toPhone: normalized,
    message: data.message,
    link: {
      leadId: data.leadId ?? null,
      customerId: data.customerId ?? null,
      tripId: data.tripId ?? null,
      invoiceId: data.invoiceId ?? null,
      bookingId: data.bookingId ?? null,
    },
  });

  revalidatePath("/communications");
  if (data.leadId) revalidatePath(`/leads/${data.leadId}`);
  if (data.tripId) revalidatePath(`/trips/${data.tripId}`);
  if (data.invoiceId) revalidatePath(`/invoices/${data.invoiceId}`);

  return {
    ok: result.status !== "FAILED",
    messageId: result.messageId,
    status: result.status,
    error: result.error,
  };
}

// === Proposal share ===

export async function shareProposalWhatsappAction(input: {
  tripId: string;
  quoteId: string;
}) {
  const user = await getOrCreateDemoUser();
  try {
    const result = await shareProposalOnWhatsapp({
      userId: user.id,
      tripId: input.tripId,
      quoteId: input.quoteId,
    });
    revalidatePath(`/trips/${input.tripId}`);
    revalidatePath(`/trips/${input.tripId}/preview`);
    revalidatePath("/communications");
    return {
      ok: result.status !== "FAILED",
      status: result.status,
      previewUrl: result.previewUrl,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (e) {
    return {
      ok: false as const,
      status: "FAILED" as const,
      error: e instanceof Error ? e.message : "Couldn't share",
      previewUrl: "",
      messageId: "",
    };
  }
}

// === Invoice share ===

const shareInvoiceSchema = z.object({
  invoiceId: z.string(),
  documentUrl: z.string().url().optional().nullable(),
});

export async function shareInvoiceWhatsappAction(input: z.infer<typeof shareInvoiceSchema>) {
  const data = shareInvoiceSchema.parse(input);
  const user = await getOrCreateDemoUser();
  try {
    const result = await shareInvoiceOnWhatsapp({
      userId: user.id,
      invoiceId: data.invoiceId,
      documentUrl: data.documentUrl ?? null,
    });
    revalidatePath(`/invoices/${data.invoiceId}`);
    revalidatePath("/invoices");
    revalidatePath("/communications");
    return {
      ok: result.status !== "FAILED",
      status: result.status,
      messageId: result.messageId,
      error: result.error,
    };
  } catch (e) {
    return {
      ok: false as const,
      status: "FAILED" as const,
      error: e instanceof Error ? e.message : "Couldn't share",
      messageId: "",
    };
  }
}

// === Manual reminders ===

const paymentReminderSchema = z.object({
  invoiceId: z.string(),
  stage: z.enum(["T_MINUS_3", "DUE_TODAY", "OVERDUE_2D"]),
});

export async function sendPaymentReminderAction(input: z.infer<typeof paymentReminderSchema>) {
  const data = paymentReminderSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const result = await sendPaymentReminder({
    userId: user.id,
    invoiceId: data.invoiceId,
    stage: data.stage,
  });
  revalidatePath(`/invoices/${data.invoiceId}`);
  revalidatePath("/communications");
  return {
    ok: result.status !== "FAILED",
    status: result.status,
    messageId: result.messageId,
    error: result.error,
  };
}

const followUpSchema = z.object({
  leadId: z.string(),
  stage: z.enum(["T_24H", "T_3D", "T_7D"]),
});

export async function sendFollowUpAction(input: z.infer<typeof followUpSchema>) {
  const data = followUpSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const result = await sendFollowUp({
    userId: user.id,
    leadId: data.leadId,
    stage: data.stage,
  });
  revalidatePath(`/leads/${data.leadId}`);
  revalidatePath("/communications");
  return {
    ok: result.status !== "FAILED",
    status: result.status,
    messageId: result.messageId,
    error: result.error,
  };
}

const tripReminderSchema = z.object({
  tripId: z.string(),
  stage: z.enum(["T_MINUS_7", "T_MINUS_1", "DEPARTURE", "THANKS"]),
});

export async function sendTripReminderAction(input: z.infer<typeof tripReminderSchema>) {
  const data = tripReminderSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const result = await sendTripReminder({
    userId: user.id,
    tripId: data.tripId,
    stage: data.stage,
  });
  revalidatePath(`/trips/${data.tripId}`);
  revalidatePath("/communications");
  return {
    ok: result.status !== "FAILED",
    status: result.status,
    messageId: result.messageId,
    error: result.error,
  };
}

export async function sendVoucherWhatsappAction(input: { voucherId: string }) {
  const user = await getOrCreateDemoUser();
  const result = await sendVoucherOnWhatsapp({
    userId: user.id,
    voucherId: input.voucherId,
  });
  revalidatePath("/operations");
  revalidatePath("/communications");
  return {
    ok: result.status !== "FAILED",
    status: result.status,
    error: result.error,
  };
}

// === Manual automation trigger ===

/**
 * Operator-triggered "run now" for the automation runner. Same code path
 * as the cron route, just doesn't require WHATSAPP_CRON_SECRET. Useful for
 * smoke-testing rules after creating one — instead of waiting for the
 * next cron tick.
 */
export async function runAutomationsNowAction() {
  const { runDueWhatsappAutomations } = await import(
    "@/server/jobs/whatsapp-automation"
  );
  const report = await runDueWhatsappAutomations();
  revalidatePath("/communications");
  revalidatePath("/communications/automations");
  const total = report.rules.reduce(
    (acc, r) => ({
      scanned: acc.scanned + r.scanned,
      dispatched: acc.dispatched + r.dispatched,
      failed: acc.failed + r.failed,
    }),
    { scanned: 0, dispatched: 0, failed: 0 }
  );
  return { ok: true as const, ...total };
}

// === Retry ===

export async function retryWhatsappMessageAction(messageId: string) {
  const result = await retryFailedMessage(messageId);
  revalidatePath("/communications");
  return {
    ok: result.status !== "FAILED",
    status: result.status,
    error: result.error,
  };
}

// === Templates ===

const variableSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  example: z.string().max(200).optional(),
  required: z.boolean().optional(),
});

const upsertTemplateSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().min(1).max(120),
  templateId: z.string().min(1).max(120).regex(/^[a-z0-9_]+$/i, "Lowercase letters, digits and underscores only"),
  category: z.enum(TEMPLATE_CATEGORIES),
  language: z.string().min(2).max(10).default("en"),
  bodyPreview: z.string().min(1).max(4000),
  variables: z.array(variableSchema),
  isActive: z.boolean().default(true),
});

export async function upsertTemplateAction(input: z.infer<typeof upsertTemplateSchema>) {
  const data = upsertTemplateSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const row = await upsertTemplate({
    userId: user.id,
    id: data.id ?? null,
    name: data.name,
    templateId: data.templateId,
    category: data.category,
    language: data.language,
    bodyPreview: data.bodyPreview,
    variables: data.variables,
    isActive: data.isActive,
  });
  revalidatePath("/communications/templates");
  revalidatePath("/communications/automations");
  return { id: row.id };
}

export async function listTemplatesAction() {
  const user = await getOrCreateDemoUser();
  return listTemplates(user.id);
}

// === Automation rules ===

const upsertRuleSchema = z.object({
  trigger: z.enum(AUTOMATION_TRIGGERS),
  templateRowId: z.string(),
  enabled: z.boolean(),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 7).default(0),
});

export async function upsertAutomationRuleAction(input: z.infer<typeof upsertRuleSchema>) {
  const data = upsertRuleSchema.parse(input);
  const user = await getOrCreateDemoUser();
  const rule = await upsertAutomationRule({
    userId: user.id,
    trigger: data.trigger,
    templateRowId: data.templateRowId,
    enabled: data.enabled,
    delayMinutes: data.delayMinutes,
  });
  revalidatePath("/communications/automations");
  return { id: rule.id };
}

export async function toggleAutomationRuleAction(input: {
  ruleId: string;
  enabled: boolean;
}) {
  const user = await getOrCreateDemoUser();
  await setAutomationRuleEnabled(user.id, input.ruleId, input.enabled);
  revalidatePath("/communications/automations");
  return { ok: true as const };
}

export async function listAutomationRulesAction() {
  const user = await getOrCreateDemoUser();
  return listAutomationRules(user.id);
}
