// Load .env.local first (Next.js convention), then fall back to .env
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fall back to .env for anything not in .env.local
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 config — datasource URLs live here, not in schema.prisma.
 *
 * For Neon (recommended Vercel DB):
 *   DATABASE_URL          = pooled connection string  (used at runtime)
 *   DATABASE_URL_UNPOOLED = direct connection string  (used by migrate)
 *
 * Both strings are in your Neon project dashboard under "Connection Details".
 * The pooled string ends in "?sslmode=require&pgbouncer=true" (or similar).
 * The direct string ends in "?sslmode=require" with no pgbouncer flag.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma Migrate uses the direct (unpooled) URL so DDL statements work.
    // At runtime the pooled URL is used via the PrismaClient constructor (see lib/db/client.ts).
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
