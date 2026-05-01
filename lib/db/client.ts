/**
 * Prisma 7 requires a Driver Adapter — it no longer connects to the DB directly.
 *
 * For Neon (Vercel's recommended Postgres): we use @prisma/adapter-neon +
 * @neondatabase/serverless which works in both Node.js and Edge runtimes.
 *
 * The pooled connection string (DATABASE_URL) is used at runtime.
 * The direct / unpooled string (DATABASE_URL_UNPOOLED) is used by Prisma Migrate
 * (configured in prisma.config.ts).
 */

import { PrismaClient } from "@prisma/client";

// ── Adapter setup ─────────────────────────────────────────────────────────────

// We import lazily so the build doesn't fail when the package isn't installed.
// Once @prisma/adapter-neon is in node_modules this resolves fine.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { neon } = require("@neondatabase/serverless");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaNeon } = require("@prisma/adapter-neon");

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    // No database connected yet — return a dummy client that logs a warning.
    // In development, routes fall back gracefully (see lib/auth/api-key.ts).
    console.warn(
      "[DeployGuard] DATABASE_URL is not set. Database features are disabled. " +
      "See .env.local for setup instructions.",
    );
    // Return a bare client; queries will fail at runtime but the app will boot.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new (PrismaClient as any)();
  }

  const sql     = neon(connectionString);
  const adapter = new PrismaNeon(sql);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
