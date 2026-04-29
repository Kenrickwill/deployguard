import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/reporting";
import type { ScanResult } from "@/types";
import type { ApiResponse } from "@/types/api";

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ content: string }>>> {
  try {
    const body = await req.json();
    const { scanResult, format = "markdown", includeSnippets = true, includeRemediation = true } = body as {
      scanResult: ScanResult;
      format?: "json" | "markdown" | "html" | "csv";
      includeSnippets?: boolean;
      includeRemediation?: boolean;
    };

    if (!scanResult) {
      return NextResponse.json({ error: "scanResult required" }, { status: 400 });
    }

    const content = generateReport(scanResult, { format, includeSnippets, includeRemediation });
    return NextResponse.json({ data: { content } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
