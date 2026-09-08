import { NextRequest, NextResponse } from "next/server";
import { productionStore } from "@/lib/production/store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const versionId = searchParams.get("versionId") || undefined;

    if (!projectId) {
      return NextResponse.json(
        { error: "Query parameter 'projectId' is required." },
        { status: 400 }
      );
    }

    const evidence = productionStore.getAggregatedEvidence(projectId, versionId);
    const publishedVersions = productionStore.getPublishedVersionsForProject(projectId);

    return NextResponse.json({
      projectId,
      evidence,
      publishedVersions,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to fetch production evidence.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
