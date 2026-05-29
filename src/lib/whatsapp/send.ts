// Dispatcher. Every outbound WhatsApp message — manual or automated — goes
// through `dispatchMessage`. It:
//
//   1. Persists a WhatsappMessage row in QUEUED state up front. This gives
//      us a stable id we can show in the UI immediately, and lets the
//      webhook later attach the wamid to the right row.
//
//   2. Honors an in-process rate limit (see rate-limit.ts).
//
//   3. Retries on Meta-flagged retryable errors with bounded exponential
//      backoff.
//
//   4. On success, stamps the wamid + SENT status + sentAt.
//      On final failure, stamps FAILED + failedReason.
//
// The function is intentionally tolerant of a missing WHATSAPP config: in
// dev / preview where credentials aren't set, it records the row as FAILED
// with a clear reason so the UI still shows what would have been sent.

import { createHash } from "crypto";
import type { Prisma, WhatsappMessageKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  postMessage,
  WhatsappApiError,
  WhatsappConfigError,
  type WhatsappCredentials,
} from "./client";
import { getAgencyWhatsappConfig } from "@/server/services/integrations";
import { normalizeWhatsappPhone } from "./phone";
import { takeWhatsappToken } from "./rate-limit";
import {
  buildTemplateBodyParams,
  interpolateTemplate,
  type TemplateVariableDef,
  type TemplateVariables,
} from "./templates";
import type {
  WaDocumentPayload,
  WaInteractivePayload,
  WaSendPayload,
  WaSendResponse,
  WaTemplateComponent,
  WaTemplatePayload,
  WaTextPayload,
} from "./types";

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

type LinkContext = {
  contactId?: string | null;
  tripId?: string | null;
  invoiceId?: string | null;
  bookingId?: string | null;
};

type DispatchBase = {
  agencyId: string;
  // The operator who triggered this send (null for automation-driven sends).
  sentByUserId?: string | null;
  toPhone: string;
  kind: WhatsappMessageKind;
  message: string;
  templateName?: string | null;
  templateId?: string | null;
  mediaUrl?: string | null;
  mediaFilename?: string | null;
  metadata?: Prisma.InputJsonValue;
  link?: LinkContext;
  automationRuleId?: string | null;
  scheduledFor?: Date | null;
  idempotencyKey?: string | null;
};

// Public-facing shape — callers don't pick `kind`, each helper hard-codes it.
type DispatchPublic = Omit<DispatchBase, "kind"> & { kind?: WhatsappMessageKind };

type SendTextArgs = DispatchPublic & {
  payloadOverride?: WaTextPayload;
};

type SendTemplateArgs = DispatchPublic & {
  templateName: string;
  language: string;
  variables: TemplateVariableDef[];
  values: TemplateVariables;
  headerComponents?: WaTemplateComponent[];
  buttonComponents?: WaTemplateComponent[];
};

type SendDocumentArgs = DispatchPublic & {
  documentUrl: string;
  filename?: string;
  caption?: string;
};

type SendInteractiveArgs = DispatchPublic & {
  payload: WaInteractivePayload["interactive"];
};

export type DispatchResult = {
  messageId: string;
  status: "SENT" | "FAILED" | "QUEUED";
  whatsappMessageId?: string;
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function buildIdempotencyKey(parts: (string | number | null | undefined)[]): string {
  const joined = parts.map((p) => (p == null ? "" : String(p))).join("|");
  return createHash("sha256").update(joined).digest("hex").slice(0, 32);
}

async function recordQueued(args: DispatchBase): Promise<string> {
  const link = args.link ?? {};
  const row = await prisma.whatsappMessage.create({
    data: {
      agencyId: args.agencyId,
      sentByUserId: args.sentByUserId ?? null,
      contactId: link.contactId ?? null,
      tripId: link.tripId ?? null,
      invoiceId: link.invoiceId ?? null,
      bookingId: link.bookingId ?? null,
      kind: args.kind,
      direction: "OUTBOUND",
      status: "QUEUED",
      templateName: args.templateName ?? null,
      templateId: args.templateId ?? null,
      phone: args.toPhone,
      message: args.message,
      mediaUrl: args.mediaUrl ?? null,
      mediaFilename: args.mediaFilename ?? null,
      metadata: args.metadata ?? {},
      idempotencyKey: args.idempotencyKey ?? null,
      automationRuleId: args.automationRuleId ?? null,
      scheduledFor: args.scheduledFor ?? null,
    },
  });
  return row.id;
}

async function findExistingByIdempotency(agencyId: string, key: string | null | undefined) {
  if (!key) return null;
  return prisma.whatsappMessage.findUnique({
    where: { agencyId_idempotencyKey: { agencyId, idempotencyKey: key } },
  });
}

async function sendWithRetries(
  payload: WaSendPayload,
  messageRowId: string,
  creds?: WhatsappCredentials
): Promise<WaSendResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await prisma.whatsappMessage.update({
      where: { id: messageRowId },
      data: { attempts: attempt },
    });
    try {
      return await postMessage(payload, creds);
    } catch (err) {
      lastError = err;
      if (err instanceof WhatsappApiError && err.retryable && attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function finalizeFailure(messageRowId: string, err: unknown) {
  const isApi = err instanceof WhatsappApiError;
  const reason =
    err instanceof Error ? err.message : "Unknown error sending WhatsApp message";
  await prisma.whatsappMessage.update({
    where: { id: messageRowId },
    data: {
      status: "FAILED",
      failedReason: reason.slice(0, 500),
      failedCode: isApi ? String(err.code) : null,
    },
  });
}

async function finalizeSuccess(messageRowId: string, res: WaSendResponse) {
  const wamid = res.messages?.[0]?.id;
  await prisma.whatsappMessage.update({
    where: { id: messageRowId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      whatsappMessageId: wamid ?? null,
    },
  });
}

async function dispatch(args: DispatchBase, payload: WaSendPayload): Promise<DispatchResult> {
  const existing = await findExistingByIdempotency(args.agencyId, args.idempotencyKey);
  if (existing) {
    return {
      messageId: existing.id,
      status: existing.status === "FAILED" ? "FAILED" : existing.status === "QUEUED" ? "QUEUED" : "SENT",
      whatsappMessageId: existing.whatsappMessageId ?? undefined,
    };
  }

  const rowId = await recordQueued(args);

  // Scheduled — leave QUEUED and let the automation runner pick it up.
  if (args.scheduledFor && args.scheduledFor.getTime() > Date.now()) {
    return { messageId: rowId, status: "QUEUED" };
  }

  const waConfig = await getAgencyWhatsappConfig(args.agencyId);
  if (!waConfig.configured || !waConfig.credentials) {
    await finalizeFailure(
      rowId,
      new WhatsappConfigError(["phoneNumberId", "accessToken"])
    );
    return {
      messageId: rowId,
      status: "FAILED",
      error:
        "WhatsApp isn't connected. Add your WhatsApp API in Settings → Integrations.",
    };
  }

  const limit = takeWhatsappToken(args.toPhone);
  if (!limit.ok) {
    await finalizeFailure(
      rowId,
      new Error(`Rate limit (${limit.scope}); retry in ${limit.retryAfterMs}ms`)
    );
    return {
      messageId: rowId,
      status: "FAILED",
      error: `Rate limited (${limit.scope}). Try again in a moment.`,
    };
  }

  try {
    const res = await sendWithRetries(payload, rowId, waConfig.credentials);
    await finalizeSuccess(rowId, res);
    return {
      messageId: rowId,
      status: "SENT",
      whatsappMessageId: res.messages?.[0]?.id,
    };
  } catch (err) {
    await finalizeFailure(rowId, err);
    return {
      messageId: rowId,
      status: "FAILED",
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
}

// === Public surface ===

export async function sendTextMessage(args: SendTextArgs): Promise<DispatchResult> {
  const to = normalizeWhatsappPhone(args.toPhone);
  if (!to) {
    return { messageId: "", status: "FAILED", error: "Invalid phone number" };
  }
  const payload: WaTextPayload = args.payloadOverride ?? {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: args.message, preview_url: true },
  };
  return dispatch({ ...args, toPhone: to, kind: "TEXT" }, payload);
}

export async function sendTemplateMessage(args: SendTemplateArgs): Promise<DispatchResult> {
  const to = normalizeWhatsappPhone(args.toPhone);
  if (!to) {
    return { messageId: "", status: "FAILED", error: "Invalid phone number" };
  }
  const bodyParams = buildTemplateBodyParams(args.variables, args.values);
  const components: WaTemplateComponent[] = [];
  if (args.headerComponents) components.push(...args.headerComponents);
  if (bodyParams.length) components.push({ type: "body", parameters: bodyParams });
  if (args.buttonComponents) components.push(...args.buttonComponents);

  const payload: WaTemplatePayload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.language },
      components: components.length ? components : undefined,
    },
  };

  // The `message` field stores the *rendered* body for in-app display so we
  // don't need to round-trip variables every time the timeline renders.
  const rendered = interpolateTemplate(args.message, args.values);

  return dispatch(
    {
      ...args,
      toPhone: to,
      kind: "TEMPLATE",
      message: rendered,
      templateName: args.templateName,
      templateId: args.templateId ?? args.templateName,
    },
    payload
  );
}

export async function sendDocumentMessage(args: SendDocumentArgs): Promise<DispatchResult> {
  const to = normalizeWhatsappPhone(args.toPhone);
  if (!to) {
    return { messageId: "", status: "FAILED", error: "Invalid phone number" };
  }
  const payload: WaDocumentPayload = {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link: args.documentUrl,
      filename: args.filename,
      caption: args.caption,
    },
  };
  return dispatch(
    {
      ...args,
      toPhone: to,
      kind: "DOCUMENT",
      mediaUrl: args.documentUrl,
      mediaFilename: args.filename ?? null,
      message: args.caption ?? args.filename ?? args.message,
    },
    payload
  );
}

export async function sendInteractiveMessage(args: SendInteractiveArgs): Promise<DispatchResult> {
  const to = normalizeWhatsappPhone(args.toPhone);
  if (!to) {
    return { messageId: "", status: "FAILED", error: "Invalid phone number" };
  }
  const payload: WaInteractivePayload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: args.payload,
  };
  return dispatch(
    { ...args, toPhone: to, kind: "INTERACTIVE" },
    payload
  );
}

/**
 * Retry a previously-failed (or queued) message. Reuses the persisted row
 * rather than creating a new one so the timeline shows the retry rather
 * than a duplicate.
 */
export async function retryFailedMessage(messageRowId: string): Promise<DispatchResult> {
  const row = await prisma.whatsappMessage.findUnique({ where: { id: messageRowId } });
  if (!row) return { messageId: messageRowId, status: "FAILED", error: "Message not found" };
  if (row.direction !== "OUTBOUND") {
    return { messageId: row.id, status: "FAILED", error: "Only outbound messages can be retried" };
  }
  if (row.status === "DELIVERED" || row.status === "READ" || row.status === "SENT") {
    return { messageId: row.id, status: "SENT", whatsappMessageId: row.whatsappMessageId ?? undefined };
  }

  await prisma.whatsappMessage.update({
    where: { id: row.id },
    data: { status: "QUEUED", failedReason: null, failedCode: null },
  });

  const waConfig = await getAgencyWhatsappConfig(row.agencyId);
  if (!waConfig.configured || !waConfig.credentials) {
    await finalizeFailure(
      row.id,
      new WhatsappConfigError(["phoneNumberId", "accessToken"])
    );
    return {
      messageId: row.id,
      status: "FAILED",
      error:
        "WhatsApp isn't connected. Add your WhatsApp API in Settings → Integrations.",
    };
  }

  const limit = takeWhatsappToken(row.phone);
  if (!limit.ok) {
    await finalizeFailure(row.id, new Error(`Rate limit (${limit.scope}); try later`));
    return { messageId: row.id, status: "FAILED", error: `Rate limited (${limit.scope}).` };
  }

  const creds = waConfig.credentials;
  let payload: WaSendPayload;
  if (row.kind === "TEMPLATE" && row.templateId) {
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    const variables = ((meta.variables as TemplateVariableDef[]) ?? []) as TemplateVariableDef[];
    const values = ((meta.values as TemplateVariables) ?? {}) as TemplateVariables;
    const language = (meta.language as string) ?? "en";
    payload = {
      messaging_product: "whatsapp",
      to: row.phone,
      type: "template",
      template: {
        name: row.templateId,
        language: { code: language },
        components: variables.length
          ? [{ type: "body", parameters: buildTemplateBodyParams(variables, values) }]
          : undefined,
      },
    };
  } else if (row.kind === "DOCUMENT" && row.mediaUrl) {
    payload = {
      messaging_product: "whatsapp",
      to: row.phone,
      type: "document",
      document: {
        link: row.mediaUrl,
        filename: row.mediaFilename ?? undefined,
        caption: row.message,
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: row.phone,
      type: "text",
      text: { body: row.message, preview_url: true },
    };
  }

  try {
    const res = await postMessage(payload, creds);
    await finalizeSuccess(row.id, res);
    return { messageId: row.id, status: "SENT", whatsappMessageId: res.messages?.[0]?.id };
  } catch (err) {
    await finalizeFailure(row.id, err);
    return { messageId: row.id, status: "FAILED", error: err instanceof Error ? err.message : "Retry failed" };
  }
}
