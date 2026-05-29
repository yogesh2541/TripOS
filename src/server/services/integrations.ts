import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { WhatsappCredentials } from "@/lib/whatsapp/client";
import type { WaApiVersion } from "@/lib/whatsapp/types";

// Per-agency integration credentials. Each agency brings its own Meta
// WhatsApp + Razorpay account (stored encrypted on AgencySettings). We resolve
// the agency's credentials first and fall back to process.env so a
// single-tenant / self-hosted deployment still works without DB config.

const DEFAULT_WA_VERSION: WaApiVersion = "v20.0";

export type CredentialSource = "agency" | "env" | null;

export type WhatsappConfig = {
  configured: boolean;
  source: CredentialSource;
  credentials: WhatsappCredentials | null;
};

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
};

export type RazorpayConfig = {
  configured: boolean;
  source: CredentialSource;
  credentials: RazorpayCredentials | null;
};

export async function getAgencyWhatsappConfig(
  agencyId: string
): Promise<WhatsappConfig> {
  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: {
      waEnabled: true,
      waPhoneNumberId: true,
      waBusinessAccountId: true,
      waApiVersion: true,
      waAccessTokenEnc: true,
      waAppSecretEnc: true,
      waWebhookVerifyToken: true,
    },
  });

  if (s?.waEnabled && s.waPhoneNumberId) {
    const accessToken = decryptSecret(s.waAccessTokenEnc);
    if (accessToken) {
      return {
        configured: true,
        source: "agency",
        credentials: {
          phoneNumberId: s.waPhoneNumberId,
          accessToken,
          businessAccountId: s.waBusinessAccountId ?? undefined,
          apiVersion: (s.waApiVersion as WaApiVersion) || DEFAULT_WA_VERSION,
          appSecret: decryptSecret(s.waAppSecretEnc) ?? undefined,
          webhookVerifyToken: s.waWebhookVerifyToken ?? undefined,
        },
      };
    }
  }

  // env fallback (single-tenant / self-hosted)
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    return {
      configured: true,
      source: "env",
      credentials: {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
        apiVersion:
          (process.env.WHATSAPP_API_VERSION as WaApiVersion) ||
          DEFAULT_WA_VERSION,
        appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
        webhookVerifyToken:
          process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined,
      },
    };
  }

  return { configured: false, source: null, credentials: null };
}

export async function isWhatsappConfiguredForAgency(
  agencyId: string
): Promise<boolean> {
  return (await getAgencyWhatsappConfig(agencyId)).configured;
}

export async function getAgencyRazorpayConfig(
  agencyId: string
): Promise<RazorpayConfig> {
  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: {
      razorpayEnabled: true,
      razorpayKeyId: true,
      razorpayKeySecretEnc: true,
      razorpayWebhookSecretEnc: true,
    },
  });

  if (s?.razorpayEnabled && s.razorpayKeyId) {
    const keySecret = decryptSecret(s.razorpayKeySecretEnc);
    if (keySecret) {
      return {
        configured: true,
        source: "agency",
        credentials: {
          keyId: s.razorpayKeyId,
          keySecret,
          webhookSecret: decryptSecret(s.razorpayWebhookSecretEnc),
        },
      };
    }
  }

  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    return {
      configured: true,
      source: "env",
      credentials: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? null,
      },
    };
  }

  return { configured: false, source: null, credentials: null };
}

export async function isRazorpayConfiguredForAgency(
  agencyId: string
): Promise<boolean> {
  return (await getAgencyRazorpayConfig(agencyId)).configured;
}
