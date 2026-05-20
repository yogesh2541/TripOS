// Meta WhatsApp Cloud API webhook receiver.
//
// GET  — handshake. Meta passes hub.mode/hub.verify_token/hub.challenge.
//        Reply with the challenge as plain text when the verify token matches
//        WHATSAPP_WEBHOOK_VERIFY_TOKEN.
//
// POST — event delivery. Body is a JSON envelope with `statuses` and/or
//        `messages`. We MUST read the raw body before parsing JSON so the
//        HMAC signature check sees the exact bytes Meta hashed.
//
// Meta retries non-2xx responses with backoff, so any handler error is
// caught and we still respond 200 — internal failures are logged and
// surfaced in the /communications UI rather than re-driven by Meta.

import { NextRequest, NextResponse } from "next/server";
import {
  processWebhookPayload,
  verifyChallenge,
  verifySignature,
  type WaWebhookPayload,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const result = verifyChallenge(
    params.get("hub.mode"),
    params.get("hub.verify_token"),
    params.get("hub.challenge")
  );
  if (!result.ok) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(result.response, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(raw) as WaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge fast — defer DB writes to the background of this same
  // request. If processing throws, log it but still 200 so Meta doesn't
  // retry storm us.
  try {
    await processWebhookPayload(payload);
  } catch (err) {
    console.error("[whatsapp/webhook] processWebhookPayload failed", err);
  }

  return NextResponse.json({ ok: true });
}
