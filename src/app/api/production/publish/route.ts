import { NextRequest, NextResponse } from "next/server";
import { PublishRequestSchema, PublishedMetadata, PROOFUI_TRACKER_VERSION } from "@/lib/production/schemas";
import { productionStore } from "@/lib/production/store";
import { injectPublishedMetadataAndTracker } from "@/lib/production/tracking-script";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = PublishRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid publish request.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { projectId, pageId, versionId, title, html, trackingEnabled } = parseResult.data;

    // Endpoint URL for first-party tracking (ProofUI server endpoint only, no external callback URLs)
    const endpointUrl = "/api/production/telemetry";

    // Embed stable metadata and tracking script
    const finalHtml = injectPublishedMetadataAndTracker(html, {
      projectId,
      pageId,
      versionId,
      endpointUrl,
      trackingEnabled,
      title,
    });

    const metadata: PublishedMetadata = {
      projectId,
      pageId,
      versionId,
      publishedAt: new Date().toISOString(),
      title,
      trackingEnabled,
      trackingVersion: PROOFUI_TRACKER_VERSION,
      endpointUrl,
    };

    // Store published version
    productionStore.publishVersion(metadata, finalHtml);

    const publishedUrl = `/api/production/view/${projectId}/${versionId}`;

    return NextResponse.json({
      success: true,
      metadata,
      publishedUrl,
      html: finalHtml,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to publish document.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
