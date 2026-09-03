import { NextRequest, NextResponse } from "next/server";
import { globalImportJobManager } from "@/lib/import/import-job-manager";
import { validatePublicUrl } from "@/lib/import/url-security";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, viewport } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "A valid website URL is required." },
        { status: 400 }
      );
    }

    // Preliminary server-side URL validation before launching browser
    const urlValidation = await validatePublicUrl(url);

    if (!urlValidation.ok) {
      return NextResponse.json(
        {
          error: urlValidation.message,
          code: urlValidation.code,
        },
        { status: 422 }
      );
    }

    const job = globalImportJobManager.createJob(url);

    // Launch capture asynchronously in background
    globalImportJobManager.startJob(job.id, {
      url,
      viewport,
    });

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      currentStage: job.currentStage,
      progressPercent: job.progressPercent,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error initiating capture." },
      { status: 500 }
    );
  }
}
