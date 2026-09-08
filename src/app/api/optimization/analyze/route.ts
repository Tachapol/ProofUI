import { NextRequest, NextResponse } from "next/server";
import {
  UXAnalyzeRequestSchema,
  UXAnalyzeStreamEvent,
} from "@/lib/optimization/schemas";
import { analyzeDocumentUX } from "@/lib/optimization/ux-analyzer";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = UXAnalyzeRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid UX analyze request.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { html, viewport, revision, liveEvidence } = parseResult.data;

    // Check if client requests streaming
    const acceptHeader = req.headers.get("accept") || "";
    const wantsStream =
      acceptHeader.includes("text/event-stream") ||
      req.nextUrl.searchParams.get("stream") === "true";

    if (!wantsStream) {
      const result = analyzeDocumentUX(html, { viewport, revision, liveEvidence });
      return NextResponse.json({ result });
    }

    // SSE Streaming
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: UXAnalyzeStreamEvent) => {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        try {
          // Status Stage 1: Preparing document
          sendEvent({
            type: "status",
            stage: "Preparing document",
            message: "Parsing DOM and building syntax tree...",
          });

          // Small delay for streaming feedback
          await new Promise((r) => setTimeout(r, 40));

          // Status Stage 2: Accessibility
          sendEvent({
            type: "status",
            stage: "Accessibility",
            message: "Auditing alt attributes, landmarks, and accessible names...",
          });
          await new Promise((r) => setTimeout(r, 40));

          // Status Stage 3: Responsive
          sendEvent({
            type: "status",
            stage: "Responsive",
            message: "Inspecting mobile overflow and touch target dimensions...",
          });
          await new Promise((r) => setTimeout(r, 40));

          // Status Stage 4: Hierarchy
          sendEvent({
            type: "status",
            stage: "Hierarchy",
            message: "Analyzing heading sequence and conversion CTA visibility...",
          });
          await new Promise((r) => setTimeout(r, 40));

          // Perform deterministic analysis
          const result = analyzeDocumentUX(html, { viewport, revision, liveEvidence });

          // Send result
          sendEvent({
            type: "result",
            result,
          });

          // Status Stage 5: Complete
          sendEvent({
            type: "status",
            stage: "Complete",
            message: "UX analysis finished.",
          });

          sendEvent({
            type: "complete",
          });

          controller.close();
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Failed to analyze UX.";
          sendEvent({
            type: "error",
            error: errorMsg,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
