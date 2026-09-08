import { NextRequest, NextResponse } from "next/server";
import { productionStore } from "@/lib/production/store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const { projectId, versionId } = await context.params;

    // Search for the published version in store
    const allVersions = productionStore.getPublishedVersionsForProject(projectId);
    const targetMeta = allVersions.find((v) => v.versionId === versionId);

    if (!targetMeta) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><h1>404 Published Version Not Found</h1><p>No published version found for project "${projectId}" and version "${versionId}".</p></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    const record = productionStore.getPublishedVersion(projectId, targetMeta.pageId, versionId);
    if (!record) {
      return new NextResponse(
        `<!DOCTYPE html><html><body><h1>404 Published Version Content Not Found</h1></body></html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    return new NextResponse(record.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
