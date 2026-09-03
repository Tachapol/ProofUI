import { NextRequest, NextResponse } from "next/server";
import { globalImportJobManager } from "@/lib/import/import-job-manager";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = globalImportJobManager.getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Import job not found or expired." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    url: job.url,
    status: job.status,
    currentStage: job.currentStage,
    progressPercent: job.progressPercent,
    result: job.result,
    error: job.error,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canceled = globalImportJobManager.cancelJob(id);

  return NextResponse.json({
    success: canceled,
    message: canceled ? "Job canceled successfully." : "Job not found or already finished.",
  });
}
