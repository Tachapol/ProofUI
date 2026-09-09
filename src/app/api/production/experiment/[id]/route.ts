import { NextRequest, NextResponse } from "next/server";
import { productionStore } from "@/lib/production/store";
import { assignVariant } from "@/lib/experiment/schemas";
import { injectPublishedMetadataAndTracker } from "@/lib/production/tracking-script";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const exp = productionStore.getExperiment(id);
    if (!exp) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><h1>404 Experiment Not Found</h1><p>Experiment "${id}" does not exist.</p></body></html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const { searchParams } = new URL(req.url);
    const clientToken =
      searchParams.get("clientToken") ||
      req.headers.get("x-client-token") ||
      `anon_${Math.random().toString(36).slice(2, 10)}`;

    const assignedVariant = assignVariant(exp.id, clientToken, exp.trafficSplit);
    const targetVersionId = exp.status === "concluded" && exp.promotedVersionId
      ? exp.promotedVersionId : assignedVariant === "control" ? exp.controlVersionId : exp.variantVersionId;

    const record = productionStore.getPublishedVersion(exp.projectId, exp.pageId, targetVersionId);
    if (!record) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><h1>404 Version Content Not Found</h1><p>Variant "${targetVersionId}" is not published.</p></body></html>`,
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    // Inject metadata + tracking script with experiment and variant IDs
    const finalHtml = injectPublishedMetadataAndTracker(record.html, {
      projectId: exp.projectId,
      pageId: exp.pageId,
      versionId: targetVersionId,
      trackingEnabled: true,
      experimentId: exp.id,
      variantId: assignedVariant,
    });

    return new NextResponse(finalHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-ProofUI-Experiment-Id": exp.id,
        "X-ProofUI-Variant": assignedVariant,
        "X-ProofUI-Version-Id": targetVersionId,
      },
    });
  } catch {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
