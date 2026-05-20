// Low-level HTTP wrapper for the WhatsApp Cloud API. The only file in the
// codebase that touches graph.facebook.com directly. Everything else goes
// through send.ts / webhook.ts.

import type {
  WaApiError,
  WaApiVersion,
  WaSendPayload,
  WaSendResponse,
} from "./types";

const GRAPH_HOST = "https://graph.facebook.com";
const DEFAULT_VERSION: WaApiVersion = "v20.0";

export class WhatsappConfigError extends Error {
  constructor(missing: string[]) {
    super(`WhatsApp Cloud API is not configured. Missing: ${missing.join(", ")}`);
    this.name = "WhatsappConfigError";
  }
}

export class WhatsappApiError extends Error {
  readonly code: number;
  readonly subcode?: number;
  readonly fbtraceId?: string;
  readonly status: number;
  readonly raw: WaApiError | unknown;

  constructor(status: number, raw: WaApiError | unknown) {
    const err = (raw as WaApiError | undefined)?.error;
    super(err?.message ?? `WhatsApp API request failed (HTTP ${status})`);
    this.name = "WhatsappApiError";
    this.status = status;
    this.code = err?.code ?? 0;
    this.subcode = err?.error_subcode;
    this.fbtraceId = err?.fbtrace_id;
    this.raw = raw;
  }

  // Meta marks certain codes as retryable (rate limits, transient).
  // See https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
  get retryable(): boolean {
    if (this.status >= 500) return true;
    if (this.status === 429) return true;
    return [80007, 130429, 131056, 131048].includes(this.code);
  }
}

export type WhatsappCredentials = {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string;
  apiVersion: WaApiVersion;
  appSecret?: string;
  webhookVerifyToken?: string;
};

export function getWhatsappCredentials(): WhatsappCredentials {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const missing: string[] = [];
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (missing.length) throw new WhatsappConfigError(missing);

  return {
    phoneNumberId: phoneNumberId!,
    accessToken: accessToken!,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || undefined,
    apiVersion: (process.env.WHATSAPP_API_VERSION as WaApiVersion) || DEFAULT_VERSION,
    appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || undefined,
  };
}

export function isWhatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN
  );
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * POST a payload to the messages endpoint. Throws WhatsappApiError on non-2xx.
 */
export async function postMessage(
  payload: WaSendPayload,
  creds = getWhatsappCredentials()
): Promise<WaSendResponse> {
  const url = `${GRAPH_HOST}/${creds.apiVersion}/${creds.phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    // Outbound to a third-party — no Next caching ever.
    cache: "no-store",
  });

  const body = await parseJsonSafe(res);
  if (!res.ok) throw new WhatsappApiError(res.status, body);
  return body as WaSendResponse;
}

/**
 * Fetch a media URL (Meta hosts media on a short-lived signed URL).
 * Used by the webhook handler when persisting inbound documents/images.
 */
export async function fetchMediaUrl(
  mediaId: string,
  creds = getWhatsappCredentials()
): Promise<{ url: string; mimeType: string; sha256: string; size: number } | null> {
  const url = `${GRAPH_HOST}/${creds.apiVersion}/${mediaId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${creds.accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    url?: string;
    mime_type?: string;
    sha256?: string;
    file_size?: number;
  };
  if (!body.url) return null;
  return {
    url: body.url,
    mimeType: body.mime_type ?? "application/octet-stream",
    sha256: body.sha256 ?? "",
    size: body.file_size ?? 0,
  };
}
