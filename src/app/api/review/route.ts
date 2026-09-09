import { NextRequest, NextResponse } from "next/server";
import { productionStore } from "@/lib/production/store";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const pageId = request.nextUrl.searchParams.get("pageId");
  if (!projectId || !pageId) return NextResponse.json({ error: "Project and page are required." }, { status: 400 });
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    activeVersionId: productionStore.getActivePublishedVersion(projectId, pageId),
    published: productionStore.getPublishedVersionsForProject(projectId).filter(v => v.pageId === pageId),
    evidence: productionStore.getAggregatedEvidence(projectId).filter(v => v.pageId === pageId),
    experiments: productionStore.getExperimentsForProject(projectId).filter(e => e.pageId === pageId)
      .map(experiment => ({ experiment, evaluation: productionStore.getExperimentEvaluation(experiment.id) })),
  }, { headers: { "Cache-Control": "no-store" } });
}
