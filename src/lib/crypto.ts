import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

// Symmetric encryption for secrets stored at rest (WhatsApp access token,
// Razorpay key secret + webhook secret). AES-256-GCM — authenticated, so a
// tampered ciphertext fails to decrypt rather than returning garbage.
//
// The key comes from CREDENTIALS_KEY (preferred — set a long random value in
// prod). If absent we derive one from NEXTAUTH_SECRET / AUTH_SECRET so the
// app still works without a brand-new env var. If NONE is set, encryption is
// refused (we never want to persist a live token in plaintext).

const FORMAT = "v1";

function keyMaterial(): string | null {
  return (
    process.env.CREDENTIALS_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    null
  );
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const material = keyMaterial();
  if (!material) {
    throw new Error(
      "Cannot encrypt credentials — set CREDENTIALS_KEY (or NEXTAUTH_SECRET) in the environment."
    );
  }
  // Derive a stable 32-byte key. The salt is fixed so the same material always
  // yields the same key (we don't store per-value salts).
  cachedKey = scryptSync(material, "tripcraft:credentials:v1", 32);
  return cachedKey;
}

/** True when an encryption key is available (so the UI can warn if not). */
export function canEncryptSecrets(): boolean {
  return keyMaterial() !== null;
}

/** Encrypt a plaintext secret → opaque "v1.iv.tag.ciphertext" (base64url). */
export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Decrypt a value produced by encryptSecret. Returns null on any failure. */
export function decryptSecret(enc: string | null | undefined): string | null {
  if (!enc) return null;
  const parts = enc.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT) return null;
  try {
    const key = getKey();
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ct = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ct), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

/** A masked hint for display, e.g. "••••••3f9c" — never reveals the secret. */
export function maskTail(value: string | null | undefined, keep = 4): string {
  if (!value) return "";
  const tail = value.slice(-keep);
  return "••••••" + tail;
}
