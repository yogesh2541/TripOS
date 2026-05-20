// WhatsApp Cloud API requires phones in E.164 *without* the leading `+`.
// We normalize aggressively because operators paste numbers from many sources
// (CRM exports, Excel, hand-typed). Anything we can't make sense of returns null.
//
// Default country code (India: 91) is configurable via env so future tenants
// outside India don't need a code change.

const DEFAULT_CC = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "91").replace(/\D/g, "");

export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");

  // Common Indian patterns: "0xxxxxxxxxx" (trunk-prefixed local), "xxxxxxxxxx" (10 digits)
  if (DEFAULT_CC === "91") {
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 10 && /^[6-9]/.test(digits)) digits = DEFAULT_CC + digits;
  }

  // Length sanity — E.164 max is 15, min ~8.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function formatWhatsappPhoneForDisplay(raw: string | null | undefined): string {
  const norm = normalizeWhatsappPhone(raw);
  if (!norm) return raw ?? "";
  // Light grouping — keep it readable, don't try to be a libphonenumber.
  return `+${norm}`;
}

export function waMeLink(raw: string | null | undefined, prefilledText?: string): string | null {
  const norm = normalizeWhatsappPhone(raw);
  if (!norm) return null;
  const base = `https://wa.me/${norm}`;
  if (!prefilledText) return base;
  return `${base}?text=${encodeURIComponent(prefilledText)}`;
}
