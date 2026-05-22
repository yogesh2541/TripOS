// Client-side permission check, mirroring the server-side [can()](src/lib/session.ts)
// engine. Used in client components to hide buttons before the user clicks
// (the server-side assertCan still gates the action — this is purely UX
// polish, not a security boundary).
//
// Keep this in sync with the STAFF_ACTIONS / VIEWER_ACTIONS sets in
// [src/lib/session.ts](src/lib/session.ts).

import type { MembershipRole } from "@prisma/client";

export type Action =
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
  | "invoice:create"
  | "invoice:update"
  | "invoice:issue"
  | "invoice:cancel"
  | "invoice:share"
  | "invoice:read"
  | "vendor:create"
  | "vendor:update"
  | "vendor:delete"
  | "vendor:read"
  | "ops:update"
  | "ops:read"
  | "whatsapp:send"
  | "whatsapp:template:manage"
  | "whatsapp:automation:manage"
  | "whatsapp:read"
  | "agency:settings"
  | "team:invite"
  | "team:remove"
  | "team:setRole"
  | "team:read";

const VIEWER_ACTIONS = new Set<Action>([
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

const STAFF_ACTIONS = new Set<Action>([
  ...Array.from(VIEWER_ACTIONS),
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
]);

export function can(role: MembershipRole, action: Action): boolean {
  if (role === "OWNER") return true;
  if (role === "STAFF") return STAFF_ACTIONS.has(action);
  if (role === "VIEWER") return VIEWER_ACTIONS.has(action);
  return false;
}
