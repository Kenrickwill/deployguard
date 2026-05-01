/**
 * POST /api/tokens  — Create a new API token
 * GET  /api/tokens  — List tokens for a project / user (hashed key not returned)
 * DELETE /api/tokens — Revoke a token by id
 *
 * In Phase 2 this route is intentionally simple — no auth guard on POST so
 * developers can bootstrap their first token. Phase 3 will add Clerk session
 * checks so only authenticated users can mint tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/client";
import { generateApiKey } from "@/lib/auth/api-key";
import type { ApiResponse } from "@/types/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateTokenSchema = z.object({
  name:       z.string().min(1).max(100),
  projectId:  z.string().optional(),
  userId:     z.string().optional(),
  scopes:     z.array(z.string()).default(["scan:write", "report:read"]),
  env:        z.enum(["live", "test"]).default("live"),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const RevokeTokenSchema = z.object({
  id: z.string().min(1),
});

// ─── POST — create ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ id: string; rawKey: string; prefix: string }>>> {
  let body: z.infer<typeof CreateTokenSchema>;
  try {
    const raw = await req.json();
    const parsed = CreateTokenSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join("; ") },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prefix, rawKey, keyHash } = generateApiKey(body.env);

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86_400_000)
    : undefined;

  let token;
  try {
    token = await db.apiToken.create({
      data: {
        name:      body.name,
        keyHash,
        prefix,
        projectId: body.projectId,
        userId:    body.userId,
        scopes:    body.scopes,
        expiresAt,
      },
    });
  } catch (err) {
    console.error("[tokens] create failed", err);
    return NextResponse.json({ error: "Failed to create token. Is the database connected?" }, { status: 503 });
  }

  // Return the raw key ONCE — it is not stored and cannot be recovered.
  return NextResponse.json({ data: { id: token.id, rawKey, prefix } }, { status: 201 });
}

// ─── GET — list ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const userId    = searchParams.get("userId");

  try {
    const tokens = await db.apiToken.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(userId    ? { userId }    : {}),
        revokedAt: null,
      },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        expiresAt: true, lastUsedAt: true, createdAt: true,
        projectId: true, userId: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: tokens });
  } catch (err) {
    console.error("[tokens] list failed", err);
    return NextResponse.json({ error: "Failed to list tokens." }, { status: 503 });
  }
}

// ─── DELETE — revoke ──────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  let body: z.infer<typeof RevokeTokenSchema>;
  try {
    const raw = await req.json();
    const parsed = RevokeTokenSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map(i => i.message).join("; ") },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await db.apiToken.update({
      where: { id: body.id },
      data:  { revokedAt: new Date() },
    });
    return NextResponse.json({ data: { revoked: true } });
  } catch (err) {
    console.error("[tokens] revoke failed", err);
    return NextResponse.json({ error: "Failed to revoke token." }, { status: 503 });
  }
}
