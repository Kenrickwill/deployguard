import { NextRequest, NextResponse } from "next/server";
import { CreateScanSchema } from "@/types/api";
import type { ApiResponse } from "@/types/api";
import type { ScanResult } from "@/types";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ScanResult>>> {
  try {
    const body = await req.json();
    const input = CreateScanSchema.safeParse(body);

    if (!input.success) {
      return NextResponse.json({ error: input.error.message }, { status: 400 });
    }

    // TODO: look up project, fetch repo files, call runScan(), persist result
    return NextResponse.json({ message: "Scan queued", data: undefined }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  // TODO: query DB for scans by projectId
  return NextResponse.json({ data: [], total: 0, page: 1, pageSize: 20, hasMore: false });
}
