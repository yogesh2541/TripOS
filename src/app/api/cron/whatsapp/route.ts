// Cron entry point for the automation runner. Designed to be poked every
// 5 minutes by an external scheduler (Vercel Cron, GitHub Actions, a
// healthcheck). Authentication is a single shared secret in the
// `Authorization: Bearer …` header, kept in WHATSAPP_CRON_SECRET.
//
// When TripCraft moves to BullMQ, this route stays — it just enqueues into
// the queue instead of running the scan in-process.

import { NextRequest, NextResponse } from "next/server";
import { runDueWhatsappAutomations } from "@/server/jobs/whatsapp-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: NextRequest) {
  const expected = process.env.WHATSAPP_CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const got = req.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDueWhatsappAutomations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/whatsapp] runDueAutomations failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}

export const POST = GET;
