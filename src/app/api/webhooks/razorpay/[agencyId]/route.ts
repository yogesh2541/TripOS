// Per-agency Razorpay webhook receiver. Each agency points its Razorpay
// webhook at this agency-scoped URL (shown in Settings → Integrations) and
// the HMAC signature is verified against THAT agency's stored webhook secret.
//
// Mirrors the single-tenant /api/webhooks/razorpay route, parameterized by
// agencyId from the path.

import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { getAgencyRazorpayConfig } from "@/server/services/integrations";
import {
  markPaymentLinkStatus,
  recordPaymentLinkPaid,
} from "@/server/services/payment-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment_link?: { entity?: { id?: string; status?: string } };
    payment?: { entity?: { id?: string } };
  };
};

export async function POST(
  req: NextRequest,
  { params }: { params: { agencyId: string } }
) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature");
  const rzp = await getAgencyRazorpayConfig(params.agencyId);

  if (!verifyRazorpayWebhook(raw, sig, rzp.credentials?.webhookSecret ?? null)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: RazorpayEvent;
  try {
    evt = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const linkId = evt.payload?.payment_link?.entity?.id ?? null;
  const paymentId = evt.payload?.payment?.entity?.id ?? null;

  try {
    if (!linkId) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    switch (evt.event) {
      case "payment_link.paid": {
        const result = await recordPaymentLinkPaid({
          providerLinkId: linkId,
          providerPaymentId: paymentId,
        });
        return NextResponse.json({ ok: true, result });
      }
      case "payment_link.cancelled":
        await markPaymentLinkStatus(linkId, "CANCELLED");
        return NextResponse.json({ ok: true });
      case "payment_link.expired":
        await markPaymentLinkStatus(linkId, "EXPIRED");
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ ok: true, ignored: evt.event ?? "unknown" });
    }
  } catch (e) {
    console.error("[razorpay webhook] processing error", e);
    return NextResponse.json({ ok: false, logged: true });
  }
}
