// Webhook processor. Validates the Meta signature, parses the payload and
// dispatches:
//
//   - status updates → flip QUEUED/SENT rows to DELIVERED/READ/FAILED
//   - inbound messages → create a new INBOUND WhatsappMessage row, attach
//     to the matching Lead/Customer (best-effort phone lookup), and log a
//     WHATSAPP_INBOUND activity so it appears on the lead timeline.
//
// Signature verification follows Meta's spec: HMAC-SHA256 with the app
// secret, hex-encoded, prefixed with "sha256=". The raw request body must
// be passed in unchanged — even reordering JSON keys breaks the hash.

import { createHmac, timingSafeEqual } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma, getOrCreateDemoUser } from "@/lib/prisma";
import { fetchMediaUrl } from "./client";
import { normalizeWhatsappPhone } from "./phone";
import type {
  WaWebhookChange,
  WaWebhookIncomingMessage,
  WaWebhookPayload,
  WaWebhookStatusUpdate,
} from "./types";

export function verifyChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null
): { ok: boolean; response?: string } {
  if (mode !== "subscribe") return { ok: false };
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expected) return { ok: false };
  if (!token || !challenge) return { ok: false };
  if (token !== expected) return { ok: false };
  return { ok: true, response: challenge };
}

export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // When app secret isn't configured we accept the request but log it — useful
  // for local dev. In production WHATSAPP_APP_SECRET should always be set.
  if (!appSecret) {
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[whatsapp/webhook] WHATSAPP_APP_SECRET not set — accepting unverified webhook");
    return true;
  }
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const got = signatureHeader.trim();
  if (got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

const STATUS_MAP: Record<WaWebhookStatusUpdate["status"], "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

async function applyStatusUpdate(update: WaWebhookStatusUpdate) {
  const message = await prisma.whatsappMessage.findUnique({
    where: { whatsappMessageId: update.id },
  });
  if (!message) return; // unknown wamid — probably another tenant's

  const nextStatus = STATUS_MAP[update.status];
  if (!nextStatus) return;

  // Forward-only state machine: don't downgrade READ → DELIVERED if updates
  // arrive out of order.
  const order: Record<typeof nextStatus, number> = {
    SENT: 1,
    DELIVERED: 2,
    READ: 3,
    FAILED: 99,
  };
  const currentRank = order[message.status as keyof typeof order] ?? 0;
  const nextRank = order[nextStatus];
  if (nextRank < currentRank && nextStatus !== "FAILED") return;

  const data: Prisma.WhatsappMessageUpdateInput = { status: nextStatus };
  const ts = new Date(Number(update.timestamp) * 1000);
  if (nextStatus === "DELIVERED" && !message.deliveredAt) data.deliveredAt = ts;
  if (nextStatus === "READ") {
    data.readAt = ts;
    if (!message.deliveredAt) data.deliveredAt = ts;
  }
  if (nextStatus === "FAILED") {
    const err = update.errors?.[0];
    data.failedReason = err?.message ?? err?.title ?? "WhatsApp marked as failed";
    data.failedCode = err?.code != null ? String(err.code) : null;
  }
  await prisma.whatsappMessage.update({ where: { id: message.id }, data });
}

function extractInboundBody(msg: WaWebhookIncomingMessage): string {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? "";
    case "button":
      return msg.button?.text ?? msg.button?.payload ?? "";
    case "interactive":
      return (
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        ""
      );
    case "image":
      return msg.image?.caption ?? "[image]";
    case "document":
      return msg.document?.caption ?? msg.document?.filename ?? "[document]";
    case "audio":
      return "[audio message]";
    case "video":
      return "[video message]";
    case "sticker":
      return "[sticker]";
    case "location":
      return "[location]";
    case "reaction":
      return `[reaction ${msg.reaction?.emoji ?? ""}]`;
    default:
      return "[unsupported message]";
  }
}

function mapKind(msg: WaWebhookIncomingMessage): "TEXT" | "DOCUMENT" | "IMAGE" | "INTERACTIVE" | "REACTION" | "LOCATION" | "UNKNOWN" {
  switch (msg.type) {
    case "text":
      return "TEXT";
    case "document":
      return "DOCUMENT";
    case "image":
      return "IMAGE";
    case "interactive":
    case "button":
      return "INTERACTIVE";
    case "reaction":
      return "REACTION";
    case "location":
      return "LOCATION";
    default:
      return "UNKNOWN";
  }
}

async function resolveLinks(userId: string, phone: string) {
  const norm = normalizeWhatsappPhone(phone);
  if (!norm) return { leadId: null, customerId: null, tripId: null };

  // Most recent active lead with this phone. We strip non-digits when
  // comparing — operators often store "+91 9..." while Meta sends "919...".
  const variants = Array.from(
    new Set([norm, `+${norm}`, norm.replace(/^91/, ""), norm.replace(/^91/, "+91 ")])
  );

  const lead = await prisma.lead.findFirst({
    where: {
      userId,
      deletedAt: null,
      OR: variants.map((v) => ({ phone: { contains: v } })),
    },
    orderBy: { updatedAt: "desc" },
    include: { customer: { select: { id: true } }, trips: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return {
    leadId: lead?.id ?? null,
    customerId: lead?.customer?.id ?? null,
    tripId: lead?.trips?.[0]?.id ?? null,
  };
}

async function persistInbound(userId: string, change: WaWebhookChange, msg: WaWebhookIncomingMessage) {
  const phone = normalizeWhatsappPhone(msg.from) ?? msg.from;
  const body = extractInboundBody(msg);
  const kind = mapKind(msg);
  const links = await resolveLinks(userId, phone);

  // Inbound media: resolve the signed URL and store it. The actual asset is
  // hosted by Meta with a 5-minute signed URL — for long-term persistence
  // an agency would re-host this. For now we store the URL + sha256 so the
  // operator can download manually before it expires.
  let mediaUrl: string | null = null;
  let mediaFilename: string | null = null;
  if (msg.type === "document" && msg.document?.id) {
    const m = await fetchMediaUrl(msg.document.id).catch(() => null);
    mediaUrl = m?.url ?? null;
    mediaFilename = msg.document.filename ?? null;
  } else if (msg.type === "image" && msg.image?.id) {
    const m = await fetchMediaUrl(msg.image.id).catch(() => null);
    mediaUrl = m?.url ?? null;
  }

  // Reply linking — best effort
  let replyToId: string | null = null;
  if (msg.context?.id) {
    const ref = await prisma.whatsappMessage.findUnique({
      where: { whatsappMessageId: msg.context.id },
      select: { id: true },
    });
    replyToId = ref?.id ?? null;
  }

  // Dedupe — Meta may redeliver. wamid is unique.
  const existing = await prisma.whatsappMessage.findUnique({
    where: { whatsappMessageId: msg.id },
  });
  if (existing) return existing;

  const created = await prisma.whatsappMessage.create({
    data: {
      userId,
      leadId: links.leadId,
      customerId: links.customerId,
      tripId: links.tripId,
      kind,
      direction: "INBOUND",
      status: "DELIVERED",
      phone,
      message: body,
      mediaUrl,
      mediaFilename,
      whatsappMessageId: msg.id,
      replyToId,
      metadata: {
        rawType: msg.type,
        from_profile_name:
          change.value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? null,
        button_payload: msg.button?.payload ?? null,
        interactive_id:
          msg.interactive?.button_reply?.id ??
          msg.interactive?.list_reply?.id ??
          null,
      },
      sentAt: new Date(Number(msg.timestamp) * 1000),
      deliveredAt: new Date(Number(msg.timestamp) * 1000),
    },
  });

  // Activity log — only when we resolved to a lead, otherwise it's an
  // unknown contact and the operator can triage from /communications.
  if (links.leadId) {
    await prisma.activity.create({
      data: {
        leadId: links.leadId,
        tripId: links.tripId,
        type: "WHATSAPP_INBOUND",
        title: "WhatsApp reply",
        body: body.slice(0, 500),
        metadata: { whatsappMessageId: created.id, phone },
      },
    });
  }

  return created;
}

export async function processWebhookPayload(payload: WaWebhookPayload) {
  // Single-tenant for now — when multi-tenancy lands, route by
  // entry[i].id (business account id) to the agency's userId.
  const user = await getOrCreateDemoUser();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (value.statuses) {
        for (const s of value.statuses) {
          try {
            await applyStatusUpdate(s);
          } catch (err) {
            console.error("[whatsapp/webhook] status update failed", err);
          }
        }
      }
      if (value.messages) {
        for (const m of value.messages) {
          try {
            await persistInbound(user.id, change, m);
          } catch (err) {
            console.error("[whatsapp/webhook] inbound persist failed", err);
          }
        }
      }
    }
  }
}
