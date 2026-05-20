// Template engine. Two halves:
//
// 1. A built-in catalogue of *seed* templates — premium, hospitality-tone
//    copy that ships with TripCraft. These are used both as defaults when
//    seeding a fresh agency and as a fallback message body when an agency
//    hasn't approved a Meta template yet (we degrade to a plain text send
//    for that case).
//
// 2. A tiny mustache-style interpolator. Variables look like {{name}} and
//    are *not* HTML-escaped (WhatsApp body is plain text).

import type { WhatsappTemplateCategory } from "@prisma/client";

export type TemplateVariableDef = {
  key: string;
  label: string;
  example?: string;
  required?: boolean;
};

export type SeedTemplate = {
  // internal name shown in UI
  name: string;
  // Meta template name (snake_case). Must be registered on Meta before
  // outbound *template* sends will succeed; until then we degrade to text.
  templateId: string;
  category: WhatsappTemplateCategory;
  language: string;
  variables: TemplateVariableDef[];
  body: string;
};

const PROPOSAL: SeedTemplate = {
  name: "Proposal share",
  templateId: "tc_proposal_share",
  category: "PROPOSAL",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Kashmir", required: true },
    { key: "proposal_link", label: "Proposal link", example: "https://tripcraft.app/v/abc", required: true },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}} ✨\n` +
    `Your curated {{destination}} experience is ready.\n` +
    `View your personalized proposal below:\n` +
    `{{proposal_link}}\n\n` +
    `— Team {{agency}}`,
};

const INVOICE: SeedTemplate = {
  name: "Invoice share",
  templateId: "tc_invoice_share",
  category: "INVOICE",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "invoice_number", label: "Invoice number", example: "TC/26-27/0001", required: true },
    { key: "amount", label: "Amount (formatted)", example: "₹ 1,82,500", required: true },
    { key: "due_status", label: "Due status", example: "Due on 12 Jun" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}},\n` +
    `Please find your tax invoice {{invoice_number}} attached.\n` +
    `Amount: {{amount}}\n` +
    `{{due_status}}\n\n` +
    `Bank details are on the invoice. Reach out anytime if you need a hand.\n\n` +
    `— Team {{agency}}`,
};

const PAYMENT_REMINDER_T3: SeedTemplate = {
  name: "Payment reminder — 3 days before",
  templateId: "tc_payment_reminder_t3",
  category: "PAYMENT_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "amount", label: "Amount due", example: "₹ 82,500", required: true },
    { key: "due_date", label: "Due date", example: "12 Jun", required: true },
    { key: "invoice_link", label: "Invoice link", example: "https://tripcraft.app/i/abc" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}} ✨\n` +
    `A gentle reminder — your balance of {{amount}} is due on {{due_date}}.\n` +
    `View invoice: {{invoice_link}}\n\n` +
    `Let us know once it's settled, or if anything's getting in the way.\n` +
    `— Team {{agency}}`,
};

const PAYMENT_REMINDER_DUE: SeedTemplate = {
  name: "Payment reminder — due today",
  templateId: "tc_payment_reminder_due",
  category: "PAYMENT_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "amount", label: "Amount due", example: "₹ 82,500", required: true },
    { key: "invoice_link", label: "Invoice link", example: "https://tripcraft.app/i/abc" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}},\n` +
    `Your balance of {{amount}} is due today. We've kept your booking warm —\n` +
    `you can settle it here: {{invoice_link}}\n\n` +
    `Thanks for choosing us.\n` +
    `— Team {{agency}}`,
};

const PAYMENT_REMINDER_OVERDUE: SeedTemplate = {
  name: "Payment reminder — 2 days overdue",
  templateId: "tc_payment_reminder_overdue",
  category: "PAYMENT_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "amount", label: "Amount due", example: "₹ 82,500", required: true },
    { key: "invoice_link", label: "Invoice link", example: "https://tripcraft.app/i/abc" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}},\n` +
    `We noticed the balance of {{amount}} is now 2 days overdue. If there's\n` +
    `anything we can help sort out — payment method, EMI, anything — just say\n` +
    `the word.\n\n` +
    `Invoice: {{invoice_link}}\n` +
    `— Team {{agency}}`,
};

const FOLLOWUP_24H: SeedTemplate = {
  name: "Follow-up — 24h after quote",
  templateId: "tc_followup_24h",
  category: "FOLLOW_UP",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Kashmir" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}} ✨\n` +
    `Did you get a chance to look through the {{destination}} proposal?\n` +
    `Happy to walk you through it or tweak anything — drop a reply when you're\n` +
    `ready.\n\n` +
    `— Team {{agency}}`,
};

const FOLLOWUP_3D: SeedTemplate = {
  name: "Follow-up — 3 days inactive",
  templateId: "tc_followup_3d",
  category: "FOLLOW_UP",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}}, just checking in 🌿\n` +
    `If the timing feels off or the brief has changed, we can rework — no\n` +
    `pressure either way. Otherwise, let's lock in those dates before the\n` +
    `hotels get snapped up.\n\n` +
    `— Team {{agency}}`,
};

const FOLLOWUP_7D: SeedTemplate = {
  name: "Follow-up — 7 days inactive",
  templateId: "tc_followup_7d",
  category: "FOLLOW_UP",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}},\n` +
    `Closing the loop on this one for now. If the trip's still on your\n` +
    `wishlist, send a quick "yes" and we'll pick it back up. Otherwise we'll\n` +
    `be here when you're ready to plan the next one ✨\n\n` +
    `— Team {{agency}}`,
};

const TRIP_T_MINUS_7: SeedTemplate = {
  name: "Trip reminder — 7 days out",
  templateId: "tc_trip_t_minus_7",
  category: "TRIP_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Rajasthan", required: true },
    { key: "start_date", label: "Start date", example: "12 Jun" },
    { key: "voucher_link", label: "Voucher / itinerary link", example: "https://tripcraft.app/v/abc" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}} ✨\n` +
    `Your {{destination}} journey begins {{start_date}} — one week to go.\n` +
    `Pre-trip checklist and vouchers are ready here:\n` +
    `{{voucher_link}}\n\n` +
    `— Team {{agency}}`,
};

const TRIP_T_MINUS_1: SeedTemplate = {
  name: "Trip reminder — day before",
  templateId: "tc_trip_t_minus_1",
  category: "TRIP_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Rajasthan", required: true },
    { key: "voucher_link", label: "Voucher / itinerary link", example: "https://tripcraft.app/v/abc" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Your {{destination}} journey begins tomorrow ✨\n` +
    `All your vouchers, hotel confirmations and contact numbers are here:\n` +
    `{{voucher_link}}\n\n` +
    `Safe travels, {{name}}.\n` +
    `— Team {{agency}}`,
};

const TRIP_DEPARTURE_DAY: SeedTemplate = {
  name: "Trip reminder — departure day",
  templateId: "tc_trip_departure_day",
  category: "TRIP_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Rajasthan", required: true },
    { key: "ops_phone", label: "24x7 ops phone", example: "+91 90000 00000" },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Bon voyage, {{name}} 🌅\n` +
    `Wishing you an unforgettable {{destination}}. Our 24x7 line is\n` +
    `{{ops_phone}} — if anything pops up, we're one message away.\n\n` +
    `— Team {{agency}}`,
};

const TRIP_THANKS: SeedTemplate = {
  name: "Trip completed — thank you",
  templateId: "tc_trip_thanks",
  category: "TRIP_REMINDER",
  language: "en",
  variables: [
    { key: "name", label: "Customer first name", example: "Rahul", required: true },
    { key: "destination", label: "Destination", example: "Rajasthan", required: true },
    { key: "review_link", label: "Review link", example: "https://g.page/r/..." },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hope {{destination}} stayed with you, {{name}} 🌿\n` +
    `If you have a moment, a short note would mean the world: {{review_link}}\n` +
    `Looking forward to crafting the next one with you.\n\n` +
    `— Team {{agency}}`,
};

const OPS_VOUCHER: SeedTemplate = {
  name: "Operations — voucher delivery",
  templateId: "tc_ops_voucher",
  category: "OPERATIONS",
  language: "en",
  variables: [
    { key: "name", label: "Recipient first name", example: "Rahul", required: true },
    { key: "voucher_title", label: "Voucher title", example: "Taj Lake Palace booking" },
    { key: "voucher_link", label: "Voucher link", example: "https://tripcraft.app/v/abc", required: true },
    { key: "agency", label: "Agency name", example: "TripCraft" },
  ],
  body:
    `Hi {{name}},\n` +
    `Sending across your {{voucher_title}}. Keep this handy at check-in.\n` +
    `{{voucher_link}}\n\n` +
    `— Team {{agency}}`,
};

export const SEED_TEMPLATES: readonly SeedTemplate[] = [
  PROPOSAL,
  INVOICE,
  PAYMENT_REMINDER_T3,
  PAYMENT_REMINDER_DUE,
  PAYMENT_REMINDER_OVERDUE,
  FOLLOWUP_24H,
  FOLLOWUP_3D,
  FOLLOWUP_7D,
  TRIP_T_MINUS_7,
  TRIP_T_MINUS_1,
  TRIP_DEPARTURE_DAY,
  TRIP_THANKS,
  OPS_VOUCHER,
];

export function findSeedTemplate(templateId: string): SeedTemplate | undefined {
  return SEED_TEMPLATES.find((t) => t.templateId === templateId);
}

export const TEMPLATE_CATEGORY_LABEL: Record<WhatsappTemplateCategory, string> = {
  PROPOSAL: "Proposal",
  INVOICE: "Invoice",
  PAYMENT_REMINDER: "Payment reminder",
  FOLLOW_UP: "Follow-up",
  TRIP_REMINDER: "Trip reminder",
  OPERATIONS: "Operations",
  UTILITY: "Utility",
  MARKETING: "Marketing",
  CUSTOM: "Custom",
};

// === Interpolation ===

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type TemplateVariables = Record<string, string | number | null | undefined>;

export function interpolateTemplate(body: string, vars: TemplateVariables): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => {
    const v = vars[key];
    if (v === null || v === undefined) return "";
    return String(v);
  });
}

/**
 * Extract the placeholder keys actually referenced in a template body.
 * Used by the preview UI to highlight missing variables.
 */
export function extractTemplateVariables(body: string): string[] {
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) seen.add(m[1]);
  return Array.from(seen);
}

/**
 * Build Meta-style positional body parameters for a template send. The Meta
 * Cloud API expects each {{1}}, {{2}} … to be supplied as an ordered array.
 * Since our editor uses *named* placeholders, we map them into positional
 * order using the template's `variables` definition.
 */
export function buildTemplateBodyParams(
  variables: TemplateVariableDef[],
  values: TemplateVariables
): Array<{ type: "text"; text: string }> {
  return variables.map((v) => ({
    type: "text" as const,
    text: String(values[v.key] ?? v.example ?? ""),
  }));
}
