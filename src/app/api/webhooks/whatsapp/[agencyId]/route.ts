// Per-agency WhatsApp Cloud API webhook receiver.
//
// Each agency connects its own Meta app and points its webhook at this
// agency-scoped URL (shown in Settings → Integrations). The verify token and
// app-secret signature are checked against THAT agency's stored credentials,
// and inbound events are attributed to that agency.
//
// Mirrors the single-tenant /api/webhooks/whatsapp route, parameterized by
// agencyId from the path.

import { NextRequest, NextResponse } from "next/server";
import {
  processWebhookPayload,
  verifyChallenge,
  verifySignature,
  type WaWebhookPayload,
} from "@/lib/whatsapp";
import { getAgencyWhatsappConfig } from "@/server/services/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { agencyId: string } }
) {
  const cfg = await getAgencyWhatsappConfig(params.agencyId);
  const sp = req.nextUrl.searchParams;
  const result = verifyChallenge(
    sp.get("hub.mode"),
    sp.get("hub.verify_token"),
    sp.get("hub.challenge"),
    cfg.credentials?.webhookVerifyToken ?? null
  );
  if (!result.ok) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(result.response, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { agencyId: string } }
) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  const cfg = await getAgencyWhatsappConfig(params.agencyId);

  if (!verifySignature(raw, sig, cfg.credentials?.appSecret ?? null)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WaWebhookPayload;
  try {
    payload = JSON.parse(raw) as WaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await processWebhookPayload(payload, params.agencyId);
  } catch (err) {
    console.error("[whatsapp/webhook] processWebhookPayload failed", err);
  }

  return NextResponse.json({ ok: true });
}
