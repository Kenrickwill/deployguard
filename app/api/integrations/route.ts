import { NextRequest, NextResponse } from "next/server";
import { IntegrationConfigSchema } from "@/types/api";
import type { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse> {
  // TODO: fetch integrations from DB for the current project/org
  return NextResponse.json({ data: [] });
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const body = await req.json();
    const input = IntegrationConfigSchema.safeParse(body);

    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 });
    }

    // TODO: persist integration config to DB (encrypt secrets before storing)
    return NextResponse.json({ data: { id: "placeholder-id" } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
