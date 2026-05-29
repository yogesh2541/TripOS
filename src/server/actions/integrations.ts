"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAgency } from "@/lib/session";
import { encryptSecret, decryptSecret, canEncryptSecrets } from "@/lib/crypto";
import { postMessage } from "@/lib/whatsapp/client";
import { normalizeWhatsappPhone } from "@/lib/whatsapp/phone";
import { verifyRazorpayKeys } from "@/lib/razorpay";
import type { WaApiVersion, WaTemplatePayload } from "@/lib/whatsapp/types";

// Owner-only: each agency manages its own WhatsApp + Razorpay credentials.
// Secrets are encrypted at rest. A blank secret field means "keep what's
// already stored" — we never clobber a saved token with an empty submit.

async function requireOwner() {
  const { agencyId, user } = await requireAgency();
  if (user.activeAgencyRole !== "OWNER") {
    throw new Error("Only the agency owner can change integrations.");
  }
  return { agencyId };
}

async function ensureSettings(agencyId: string) {
  const existing = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error(
      "Set up your agency identity in Settings → Agency before connecting integrations."
    );
  }
}

const BLANK = ""; // a blank secret submit = leave the stored value untouched

// --- WhatsApp --------------------------------------------------------------

const whatsappSchema = z.object({
  enabled: z.boolean(),
  phoneNumberId: z.string().trim().max(64).optional().default(""),
  businessAccountId: z.string().trim().max(64).optional().default(""),
  apiVersion: z.string().trim().max(12).optional().default(""),
  // Secrets — blank means "unchanged".
  accessToken: z.string().optional().default(""),
  appSecret: z.string().optional().default(""),
  webhookVerifyToken: z.string().trim().max(120).optional().default(""),
});

export type SaveWhatsappInput = z.infer<typeof whatsappSchema>;

export async function saveWhatsappIntegrationAction(input: SaveWhatsappInput) {
  const data = whatsappSchema.parse(input);
  const { agencyId } = await requireOwner();
  await ensureSettings(agencyId);

  if ((data.accessToken || data.appSecret) && !canEncryptSecrets()) {
    return {
      ok: false as const,
      error:
        "Server can't encrypt secrets — set CREDENTIALS_KEY (or NEXTAUTH_SECRET) in the environment.",
    };
  }

  if (data.enabled && !data.phoneNumberId) {
    return {
      ok: false as const,
      error: "Add your WhatsApp Phone Number ID to enable sending.",
    };
  }

  // Auto-mint a verify token the first time, so the agency has one to paste
  // into Meta even if they didn't type one.
  const current = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: { waWebhookVerifyToken: true, waAccessTokenEnc: true },
  });
  const verifyToken =
    data.webhookVerifyToken ||
    current?.waWebhookVerifyToken ||
    randomBytes(18).toString("base64url");

  if (data.enabled && !data.accessToken && !current?.waAccessTokenEnc) {
    return {
      ok: false as const,
      error: "Add your WhatsApp access token to enable sending.",
    };
  }

  await prisma.agencySettings.update({
    where: { agencyId },
    data: {
      waEnabled: data.enabled,
      waPhoneNumberId: data.phoneNumberId || null,
      waBusinessAccountId: data.businessAccountId || null,
      waApiVersion: data.apiVersion || null,
      waWebhookVerifyToken: verifyToken,
      // Only overwrite secrets when a new value was supplied.
      ...(data.accessToken !== BLANK
        ? { waAccessTokenEnc: encryptSecret(data.accessToken) }
        : {}),
      ...(data.appSecret !== BLANK
        ? { waAppSecretEnc: encryptSecret(data.appSecret) }
        : {}),
    },
  });

  revalidatePath("/settings/integrations");
  return { ok: true as const };
}

// --- Razorpay --------------------------------------------------------------

const razorpaySchema = z.object({
  enabled: z.boolean(),
  keyId: z.string().trim().max(64).optional().default(""),
  keySecret: z.string().optional().default(""),
  webhookSecret: z.string().optional().default(""),
});

export type SaveRazorpayInput = z.infer<typeof razorpaySchema>;

export async function saveRazorpayIntegrationAction(input: SaveRazorpayInput) {
  const data = razorpaySchema.parse(input);
  const { agencyId } = await requireOwner();
  await ensureSettings(agencyId);

  if ((data.keySecret || data.webhookSecret) && !canEncryptSecrets()) {
    return {
      ok: false as const,
      error:
        "Server can't encrypt secrets — set CREDENTIALS_KEY (or NEXTAUTH_SECRET) in the environment.",
    };
  }

  const current = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: { razorpayKeySecretEnc: true },
  });

  if (data.enabled && !data.keyId) {
    return { ok: false as const, error: "Add your Razorpay Key ID to enable payments." };
  }
  if (data.enabled && !data.keySecret && !current?.razorpayKeySecretEnc) {
    return {
      ok: false as const,
      error: "Add your Razorpay Key Secret to enable payments.",
    };
  }

  await prisma.agencySettings.update({
    where: { agencyId },
    data: {
      razorpayEnabled: data.enabled,
      razorpayKeyId: data.keyId || null,
      ...(data.keySecret !== BLANK
        ? { razorpayKeySecretEnc: encryptSecret(data.keySecret) }
        : {}),
      ...(data.webhookSecret !== BLANK
        ? { razorpayWebhookSecretEnc: encryptSecret(data.webhookSecret) }
        : {}),
    },
  });

  revalidatePath("/settings/integrations");
  return { ok: true as const };
}

// --- connection tests ------------------------------------------------------

const testWaSchema = z.object({ toPhone: z.string().trim().min(6).max(20) });

/**
 * Send the standard Meta "hello_world" sample template to a number using the
 * agency's SAVED credentials — works without a prior conversation (templates
 * bypass the 24-hour session window), so it's the canonical connectivity test.
 * Bypasses the normal logged-send pipeline; it's purely a credential probe.
 */
export async function sendTestWhatsappAction(input: { toPhone: string }) {
  const { toPhone } = testWaSchema.parse(input);
  const { agencyId } = await requireOwner();

  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: {
      waPhoneNumberId: true,
      waApiVersion: true,
      waAccessTokenEnc: true,
    },
  });
  const accessToken = decryptSecret(s?.waAccessTokenEnc);
  if (!s?.waPhoneNumberId || !accessToken) {
    return {
      ok: false as const,
      error: "Save your Phone Number ID and access token first, then test.",
    };
  }

  const to = normalizeWhatsappPhone(toPhone);
  if (!to) {
    return {
      ok: false as const,
      error: "Enter a valid number with country code, e.g. +91 98xxxxxxxx.",
    };
  }

  const payload: WaTemplatePayload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: "hello_world", language: { code: "en_US" } },
  };

  try {
    await postMessage(payload, {
      phoneNumberId: s.waPhoneNumberId,
      accessToken,
      apiVersion: (s.waApiVersion as WaApiVersion) || "v20.0",
    });
    return { ok: true as const, to };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "WhatsApp send failed.",
    };
  }
}

/** Validate the agency's saved Razorpay keys against the live API. */
export async function verifyRazorpayKeysAction() {
  const { agencyId } = await requireOwner();
  const s = await prisma.agencySettings.findUnique({
    where: { agencyId },
    select: { razorpayKeyId: true, razorpayKeySecretEnc: true },
  });
  const keySecret = decryptSecret(s?.razorpayKeySecretEnc);
  if (!s?.razorpayKeyId || !keySecret) {
    return {
      ok: false as const,
      error: "Save your Key ID and Key Secret first, then verify.",
    };
  }
  return verifyRazorpayKeys({ keyId: s.razorpayKeyId, keySecret });
}
