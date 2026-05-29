import "server-only";
import { getSessionUser } from "@/lib/session";

// Platform owner (super-admin) access. This is the app *owner*, distinct from
// an agency OWNER. Membership is an env allowlist — there is deliberately no
// in-app way to grant it, so it can't be escalated through the product.
//
//   PLATFORM_ADMIN_EMAILS="you@yourco.com,ops@yourco.com"

export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase());
}

/** Session user if they're a platform admin, else null. */
export async function getPlatformAdmin() {
  const user = await getSessionUser();
  if (!user || !isPlatformAdminEmail(user.email)) return null;
  return user;
}

/** Throws if the caller isn't a platform admin — for server actions. */
export async function requirePlatformAdmin() {
  const user = await getPlatformAdmin();
  if (!user) {
    throw new Error("Forbidden — platform admin only.");
  }
  return user;
}
