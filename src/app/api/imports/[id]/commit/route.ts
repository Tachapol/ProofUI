import { NextRequest, NextResponse } from "next/server";
import { globalImportJobManager } from "@/lib/import/import-job-manager";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = globalImportJobManager.getJob(id);

  if (!job || !job.result) {
    return NextResponse.json(
      { error: "Capture package not found or job incomplete." },
      { status: 404 }
    );
  }

  // Return the verified sanitized document and DESIGN.md to load into ProofUI
  return NextResponse.json({
    id: job.result.id,
    title: job.result.title,
    sourceUrl: job.result.finalUrl,
    sanitizedHtml: job.result.sanitizedHtml,
    designMarkdown: job.result.designMarkdown,
    tokens: job.result.designTokens,
    assets: job.result.assets,
    warnings: job.result.warnings,
  });
}
