/**
 * Prisma 7 + Neon adapter (WebSocket Pool).
 *
 * PrismaNeon takes a PoolConfig directly — no need to import neon() separately.
 * The pooled DATABASE_URL is used at runtime; migrations use DATABASE_URL_UNPOOLED
 * (configured in prisma.config.ts).
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon }   from "@prisma/adapter-neon";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "[DeployGuard] DATABASE_URL is not set. Add it to .env.local and restart the dev server.",
    );
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
