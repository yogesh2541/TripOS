// Session + permission helpers used by every server action and server
// component. Keep this surface tiny and well-typed — these are the
// security guardrails for the whole app.

import { redirect } from "next/navigation";
import type { MembershipRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  activeAgencyId: string;
  activeAgencyRole: MembershipRole;
  activeAgencyName: string;
};

/**
 * Returns the session user OR null. Use only when "not logged in" is a
 * valid state for the caller (e.g. landing pages). Otherwise use
 * `requireUser()` which redirects.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.activeAgencyId) return null;
  return session.user as SessionUser;
}

/**
 * Returns the session user or redirects to /login. The contract every
 * authenticated page + server action should use.
 */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * Convenience for the most common pattern: scope a Prisma query to the
 * current agency. Returns `{ user, agencyId }`.
 */
export async function requireAgency(): Promise<{
  user: SessionUser;
  agencyId: string;
}> {
  const user = await requireUser();
  return { user, agencyId: user.activeAgencyId };
}

export type AgencyMember = {
  id: string;
  name: string;
  role: MembershipRole;
};

/**
 * Active (non-suspended) members of an agency — used to populate owner /
 * assignee pickers. Names fall back to email when a user hasn't set one.
 */
export async function listAgencyMembers(
  agencyId: string
): Promise<AgencyMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { agencyId, suspendedAt: null },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
    role: m.role,
  }));
}

// === Permission engine ===
//
// `can(role, action)` answers a single yes/no for a role-action pair.
// Server actions call `assertCan()` to throw before doing damage; UI
// components call `can()` to hide buttons.
//
// Action names use a "domain:verb" convention. Keep the action list
// flat and explicit — it's worth more lines than wrestling with role
// hierarchies. Granularity beyond OWNER/STAFF/VIEWER (e.g. "only
// Accounts can cancel invoices") goes here when a customer asks.

export type Action =
  // Pipeline / CRM
  | "contact:create"
  | "contact:update"
  | "contact:delete"
  | "contact:assign"
  | "contact:read"
  | "trip:create"
  | "trip:update"
  | "trip:delete"
  | "trip:read"
  | "quote:create"
  | "quote:update"
  | "quote:accept"
  | "quote:share"
  | "quote:read"
  | "booking:create"
  | "booking:cancel"
  | "booking:read"
  | "payment:create"
  | "payment:delete"
  | "payment:read"
  // Billing / invoicing
  | "invoice:create"
  | "invoice:update"
  | "invoice:issue"
  | "invoice:cancel"
  | "invoice:share"
  | "invoice:read"
  // Vendors / operations
  | "vendor:create"
  | "vendor:update"
  | "vendor:delete"
  | "vendor:read"
  | "ops:update"
  | "ops:read"
  // Communications
  | "whatsapp:send"
  | "whatsapp:template:manage"
  | "whatsapp:automation:manage"
  | "whatsapp:read"
  // Agency administration
  | "agency:settings"
  | "team:invite"
  | "team:remove"
  | "team:setRole"
  | "team:read";

const VIEWER_ACTIONS: ReadonlySet<Action> = new Set([
  "contact:read",
  "trip:read",
  "quote:read",
  "booking:read",
  "payment:read",
  "invoice:read",
  "vendor:read",
  "ops:read",
  "whatsapp:read",
  "team:read",
]);

const STAFF_ACTIONS: ReadonlySet<Action> = new Set([
  ...VIEWER_ACTIONS,
  "contact:create",
  "contact:update",
  "contact:assign",
  "trip:create",
  "trip:update",
  "quote:create",
  "quote:update",
  "quote:accept",
  "quote:share",
  "booking:create",
  "booking:cancel",
  "payment:create",
  "payment:delete",
  "invoice:create",
  "invoice:update",
  "invoice:issue",
  "invoice:cancel",
  "invoice:share",
  "vendor:create",
  "vendor:update",
  "ops:update",
  "whatsapp:send",
  "whatsapp:template:manage",
  "whatsapp:automation:manage",
] as Action[]);

export function can(role: MembershipRole, action: Action): boolean {
  if (role === "OWNER") return true; // Owner can do everything.
  if (role === "STAFF") return STAFF_ACTIONS.has(action);
  if (role === "VIEWER") return VIEWER_ACTIONS.has(action);
  return false;
}

/**
 * Throws if the current user's role can't perform `action`. Server actions
 * call this at the top of every mutating handler.
 */
export async function assertCan(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.activeAgencyRole, action)) {
    throw new Error(
      `Your role (${user.activeAgencyRole}) does not allow this action.`
    );
  }
  return user;
}
