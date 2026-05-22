// Automation runner. Called by `/api/cron/whatsapp` (and re-callable from a
// future BullMQ worker without code changes).
//
// For each enabled rule, scan the relevant domain for entities currently in
// the trigger window and dispatch a message *unless* one has already been
// sent (idempotency keys handle the actual dedupe; we also pre-filter by
// scanning the WhatsappMessage table for the same automationRuleId+entity
// in the last 36h, which is cheaper than relying solely on the unique
// constraint).
//
// Time windows are deliberately wide (e.g. T-3 = 2.5 to 3.5 days out) so
// a 5-minute cron doesn't miss anything. Idempotency handles the overlap.

import {
  type Booking,
  type Invoice,
  type Contact,
  type Quote,
  type Trip,
  type WhatsappAutomationRule,
  type WhatsappAutomationTrigger,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendFollowUp,
  sendPaymentReminder,
  sendTripReminder,
  shareInvoiceOnWhatsapp,
} from "@/server/services/whatsapp";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type RuleResult = {
  trigger: WhatsappAutomationTrigger;
  scanned: number;
  dispatched: number;
  failed: number;
};

export type AutomationRunReport = {
  startedAt: string;
  finishedAt: string;
  rules: RuleResult[];
};

function dayWindow(daysFromNow: number, padHours = 12) {
  const target = Date.now() + daysFromNow * DAY;
  return {
    start: new Date(target - padHours * HOUR),
    end: new Date(target + padHours * HOUR),
  };
}

async function recentlyDispatched(args: {
  agencyId: string;
  automationRuleId: string;
  entityField: "contactId" | "tripId" | "invoiceId" | "bookingId";
  entityId: string;
  withinHours?: number;
}): Promise<boolean> {
  const since = new Date(Date.now() - (args.withinHours ?? 36) * HOUR);
  const row = await prisma.whatsappMessage.findFirst({
    where: {
      agencyId: args.agencyId,
      automationRuleId: args.automationRuleId,
      [args.entityField]: args.entityId,
      createdAt: { gte: since },
      status: { not: "FAILED" },
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function runFollowUpRule(rule: WhatsappAutomationRule): Promise<RuleResult> {
  const stage: "T_24H" | "T_3D" | "T_7D" =
    rule.trigger === "QUOTE_SENT_NO_REPLY_24H"
      ? "T_24H"
      : rule.trigger === "QUOTE_SENT_NO_REPLY_3D"
        ? "T_3D"
        : "T_7D";
  const days = stage === "T_24H" ? 1 : stage === "T_3D" ? 3 : 7;
  const since = new Date(Date.now() - (days + 0.25) * DAY);
  const until = new Date(Date.now() - (days - 0.25) * DAY);

  // Sent-quotes that haven't received any inbound WhatsApp since `since`.
  const quotes = await prisma.quote.findMany({
    where: {
      status: "SENT",
      updatedAt: { gte: since, lte: until },
      trip: { agencyId: rule.agencyId },
    },
    include: { trip: { include: { contact: true } } },
  });

  let dispatched = 0;
  let failed = 0;
  for (const q of quotes) {
    const contact = q.trip.contact;
    if (!contact?.phone) continue;
    if (contact.status !== "QUOTED" && contact.status !== "FOLLOW_UP") continue;

    const reply = await prisma.whatsappMessage.findFirst({
      where: {
        contactId: contact.id,
        direction: "INBOUND",
        createdAt: { gte: q.updatedAt },
      },
      select: { id: true },
    });
    if (reply) continue;

    if (
      await recentlyDispatched({
        agencyId: rule.agencyId,
        automationRuleId: rule.id,
        entityField: "contactId",
        entityId: contact.id,
        withinHours: days * 24 - 12,
      })
    )
      continue;

    try {
      const res = await sendFollowUp({
        agencyId: rule.agencyId,
        contactId: contact.id,
        stage,
        automationRuleId: rule.id,
      });
      if (res.status === "FAILED") failed++;
      else dispatched++;
    } catch (err) {
      console.error("[automation/follow-up] failed", err);
      failed++;
    }
  }
  return { trigger: rule.trigger, scanned: quotes.length, dispatched, failed };
}

async function runInvoiceIssuedRule(rule: WhatsappAutomationRule): Promise<RuleResult> {
  const since = new Date(Date.now() - 12 * HOUR);
  const invoices = await prisma.invoice.findMany({
    where: {
      agencyId: rule.agencyId,
      status: "ISSUED",
      issuedAt: { gte: since },
    },
    select: { id: true },
  });

  let dispatched = 0;
  let failed = 0;
  for (const inv of invoices) {
    if (
      await recentlyDispatched({
        agencyId: rule.agencyId,
        automationRuleId: rule.id,
        entityField: "invoiceId",
        entityId: inv.id,
        withinHours: 48,
      })
    )
      continue;
    try {
      const res = await shareInvoiceOnWhatsapp({ agencyId: rule.agencyId, invoiceId: inv.id });
      if (res.status === "FAILED") failed++;
      else dispatched++;
    } catch (err) {
      console.error("[automation/invoice-issued] failed", err);
      failed++;
    }
  }
  return { trigger: rule.trigger, scanned: invoices.length, dispatched, failed };
}

async function runPaymentReminderRule(rule: WhatsappAutomationRule): Promise<RuleResult> {
  const stage: "T_MINUS_3" | "DUE_TODAY" | "OVERDUE_2D" =
    rule.trigger === "PAYMENT_DUE_T_MINUS_3"
      ? "T_MINUS_3"
      : rule.trigger === "PAYMENT_DUE_TODAY"
        ? "DUE_TODAY"
        : "OVERDUE_2D";

  const offsetDays = stage === "T_MINUS_3" ? -3 : stage === "DUE_TODAY" ? 0 : 2;
  const win = dayWindow(offsetDays);

  // Invoices with their *due date* (proxy = invoiceDate) in the window
  // AND with an outstanding balance. We compute balance in JS — keeping
  // the query simple beats trying to do this as a SQL aggregate.
  const invoices = await prisma.invoice.findMany({
    where: {
      agencyId: rule.agencyId,
      status: "ISSUED",
      invoiceDate: { gte: win.start, lte: win.end },
    },
    include: { booking: { include: { payments: true } } },
  });

  let dispatched = 0;
  let failed = 0;
  let scanned = 0;
  for (const inv of invoices) {
    const paid = inv.booking.payments.reduce((s, p) => s + p.amount, 0);
    if (paid >= inv.grandTotal) continue;
    scanned++;
    if (
      await recentlyDispatched({
        agencyId: rule.agencyId,
        automationRuleId: rule.id,
        entityField: "invoiceId",
        entityId: inv.id,
        withinHours: 36,
      })
    )
      continue;
    try {
      const res = await sendPaymentReminder({
        agencyId: rule.agencyId,
        invoiceId: inv.id,
        stage,
        automationRuleId: rule.id,
      });
      if (res.status === "FAILED") failed++;
      else dispatched++;
    } catch (err) {
      console.error("[automation/payment-reminder] failed", err);
      failed++;
    }
  }
  return { trigger: rule.trigger, scanned, dispatched, failed };
}

async function runTripReminderRule(rule: WhatsappAutomationRule): Promise<RuleResult> {
  const stage: "T_MINUS_7" | "T_MINUS_1" | "DEPARTURE" | "THANKS" =
    rule.trigger === "TRIP_T_MINUS_7"
      ? "T_MINUS_7"
      : rule.trigger === "TRIP_T_MINUS_1"
        ? "T_MINUS_1"
        : rule.trigger === "TRIP_DEPARTURE_DAY"
          ? "DEPARTURE"
          : "THANKS";

  const offsetDays = stage === "T_MINUS_7" ? 7 : stage === "T_MINUS_1" ? 1 : stage === "DEPARTURE" ? 0 : -1;
  const padHours = stage === "DEPARTURE" ? 6 : 12;
  const win = dayWindow(offsetDays, padHours);

  // For THANKS (departure was yesterday → trip completed today-ish) we
  // also gate on status to avoid double-firing on still-in-progress trips.
  const trips = await prisma.trip.findMany({
    where: {
      agencyId: rule.agencyId,
      startDate: { gte: win.start, lte: win.end },
      contact: { phone: { not: null } },
      ...(stage === "THANKS" ? { status: { in: ["COMPLETED", "IN_PROGRESS"] } } : {}),
    },
    select: { id: true },
  });

  let dispatched = 0;
  let failed = 0;
  for (const t of trips) {
    if (
      await recentlyDispatched({
        agencyId: rule.agencyId,
        automationRuleId: rule.id,
        entityField: "tripId",
        entityId: t.id,
        withinHours: 36,
      })
    )
      continue;
    try {
      const res = await sendTripReminder({
        agencyId: rule.agencyId,
        tripId: t.id,
        stage,
        automationRuleId: rule.id,
      });
      if (res.status === "FAILED") failed++;
      else dispatched++;
    } catch (err) {
      console.error("[automation/trip-reminder] failed", err);
      failed++;
    }
  }
  return { trigger: rule.trigger, scanned: trips.length, dispatched, failed };
}

async function runOneRule(rule: WhatsappAutomationRule): Promise<RuleResult> {
  switch (rule.trigger) {
    case "QUOTE_SENT_NO_REPLY_24H":
    case "QUOTE_SENT_NO_REPLY_3D":
    case "QUOTE_SENT_NO_REPLY_7D":
      return runFollowUpRule(rule);
    case "PAYMENT_DUE_T_MINUS_3":
    case "PAYMENT_DUE_TODAY":
    case "PAYMENT_OVERDUE_2D":
      return runPaymentReminderRule(rule);
    case "TRIP_T_MINUS_7":
    case "TRIP_T_MINUS_1":
    case "TRIP_DEPARTURE_DAY":
    case "TRIP_COMPLETED_THANKS":
      return runTripReminderRule(rule);
    case "INVOICE_ISSUED":
      return runInvoiceIssuedRule(rule);
    default: {
      const _never: never = rule.trigger;
      return { trigger: rule.trigger, scanned: 0, dispatched: 0, failed: 0 };
    }
  }
}

/**
 * Scan every enabled automation rule for due work and dispatch. Designed
 * to be called every 5 minutes; safe to call more often (idempotency keys
 * keep doubles out).
 */
export async function runDueWhatsappAutomations(): Promise<AutomationRunReport> {
  const startedAt = new Date().toISOString();
  const rules = await prisma.whatsappAutomationRule.findMany({
    where: { enabled: true },
  });
  const results: RuleResult[] = [];
  for (const rule of rules) {
    try {
      results.push(await runOneRule(rule));
    } catch (err) {
      console.error("[automation] rule failed", rule.trigger, err);
      results.push({ trigger: rule.trigger, scanned: 0, dispatched: 0, failed: 1 });
    }
  }
  // Also drain scheduled-for messages that have come due, regardless of rule.
  await drainScheduledMessages();

  return { startedAt, finishedAt: new Date().toISOString(), rules: results };
}

/**
 * Any QUEUED message whose scheduledFor is in the past gets sent now.
 * Useful for "send tomorrow at 9am" composer flows; the row is created
 * with a future scheduledFor and the cron picks it up later.
 */
async function drainScheduledMessages() {
  const due = await prisma.whatsappMessage.findMany({
    where: {
      status: "QUEUED",
      direction: "OUTBOUND",
      scheduledFor: { lte: new Date() },
    },
    select: { id: true },
    take: 50,
  });
  if (!due.length) return;
  const { retryFailedMessage } = await import("@/lib/whatsapp/send");
  for (const m of due) {
    try {
      await retryFailedMessage(m.id);
    } catch (err) {
      console.error("[automation] drain scheduled failed", err);
    }
  }
}
