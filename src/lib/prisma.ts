import { PrismaClient, Prisma } from "@prisma/client";

// Cache the client on globalThis so Next.js HMR doesn't open a new pool on
// every reload. Key the cache by the engine version so regenerating the
// client (e.g. after a schema edit) invalidates the cached instance — no
// dev-server restart needed for the new models to show up.
const CACHE_KEY = `prisma_${Prisma.prismaVersion?.client ?? "0"}`;
const g = globalThis as unknown as Record<string, PrismaClient | undefined>;

export const prisma =
  g[CACHE_KEY] ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g[CACHE_KEY] = prisma;

export const DEMO_USER_EMAIL = "demo@tripcraft.app";

export async function getOrCreateDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL },
  });
}
