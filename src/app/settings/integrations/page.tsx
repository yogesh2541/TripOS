import { headers } from "next/headers";
import { Plug } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { IntegrationsForm } from "@/components/settings/integrations-form";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { canEncryptSecrets } from "@/lib/crypto";

export const dynamic = "force-dynamic";

function appOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function IntegrationsSettingsPage() {
  const { agencyId, user } = await requireAgency();
  const isOwner = user.activeAgencyRole === "OWNER";

  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: {
      waEnabled: true,
      waPhoneNumberId: true,
      waBusinessAccountId: true,
      waApiVersion: true,
      waWebhookVerifyToken: true,
      waAccessTokenEnc: true,
      waAppSecretEnc: true,
      razorpayEnabled: true,
      razorpayKeyId: true,
      razorpayKeySecretEnc: true,
      razorpayWebhookSecretEnc: true,
    },
  });

  const origin = appOrigin();

  return (
    <PageShell>
      <header className="mb-7">
        <p className="tc-eyebrow gold">
          <Plug className="h-[13px] w-[13px]" />
          Settings
        </p>
        <h1 className="tc-page-title mt-2.5">Integrations</h1>
        <p className="tc-page-sub">
          Connect your own WhatsApp Business API and payment gateway. Your keys
          stay yours — messages send from your number and payments land in your
          account.
        </p>
      </header>

      {!isOwner ? (
        <EmptyState
          icon={<Plug className="h-5 w-5" />}
          title="Owner access required"
          body="Only the agency owner can manage integration credentials. Ask an owner to connect WhatsApp or payments."
          variant="card"
        />
      ) : !s ? (
        <EmptyState
          icon={<Plug className="h-5 w-5" />}
          title="Set up your agency first"
          body="Add your agency identity in Settings → Agency, then come back to connect WhatsApp and payments."
          variant="card"
        />
      ) : (
        <IntegrationsForm
          canEncrypt={canEncryptSecrets()}
          whatsapp={{
            enabled: s.waEnabled,
            phoneNumberId: s.waPhoneNumberId ?? "",
            businessAccountId: s.waBusinessAccountId ?? "",
            apiVersion: s.waApiVersion ?? "",
            verifyToken: s.waWebhookVerifyToken ?? "",
            hasAccessToken: Boolean(s.waAccessTokenEnc),
            hasAppSecret: Boolean(s.waAppSecretEnc),
            webhookUrl: `${origin}/api/webhooks/whatsapp/${agencyId}`,
          }}
          razorpay={{
            enabled: s.razorpayEnabled,
            keyId: s.razorpayKeyId ?? "",
            hasKeySecret: Boolean(s.razorpayKeySecretEnc),
            hasWebhookSecret: Boolean(s.razorpayWebhookSecretEnc),
            webhookUrl: `${origin}/api/webhooks/razorpay/${agencyId}`,
          }}
        />
      )}
    </PageShell>
  );
}
