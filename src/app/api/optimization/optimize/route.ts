import { NextRequest, NextResponse } from "next/server";
import {
  UXOptimizationRequestSchema,
  UXOptimizationStage,
} from "@/lib/optimization/schemas";
import {
  buildOptimizationGenerationRequest,
  buildOptimizationCandidateSummary,
} from "@/lib/optimization/optimization-context-builder";
import { createGenerationProvider } from "@/lib/generation/provider-factory";
import { MockPageGenerationProvider } from "@/lib/generation/mock-provider";
import { sanitizeGeneratedHtml } from "@/lib/generation/sanitizer";
import { GenerationError } from "@/lib/generation/qwen-provider";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = UXOptimizationRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid optimization request.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const optimizationRequest = parseResult.data;

    // Resolve provider securely on the server (do not allow client to send keys or arbitrary provider)
    let provider;
    try {
      provider = createGenerationProvider();
    } catch (err) {
      if (err instanceof GenerationError) {
        provider = new MockPageGenerationProvider();
      } else {
        return NextResponse.json(
          { error: "Failed to initialize generation provider." },
          { status: 500 }
        );
      }
    }

    // Build standard generation request
    const genRequest = buildOptimizationGenerationRequest(optimizationRequest);

    // Check if client requests streaming
    const acceptHeader = req.headers.get("accept") || "";
    const wantsStream =
      acceptHeader.includes("text/event-stream") ||
      req.nextUrl.searchParams.get("stream") === "true";

    if (!wantsStream) {
      let result;
      try {
        result = await provider.generate(genRequest, { signal: req.signal });
      } catch (err) {
        if (provider instanceof MockPageGenerationProvider) throw err;
        const fallbackProvider = new MockPageGenerationProvider();
        result = await fallbackProvider.generate(genRequest, { signal: req.signal });
      }

      const sanitized = sanitizeGeneratedHtml(result.html);
      const summary = buildOptimizationCandidateSummary(optimizationRequest.selectedFindings);

      return NextResponse.json({
        result: {
          ...result,
          summary,
          html: sanitized.sanitizedHtml,
          validation: {
            valid: sanitized.isValid,
            diagnostics: sanitized.diagnostics,
          },
        },
      });
    }

    // SSE Streaming
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: {
          type: "status" | "result" | "complete" | "error";
          stage?: UXOptimizationStage;
          message?: string;
          result?: unknown;
          error?: string;
        }) => {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        try {
          sendEvent({
            type: "status",
            stage: "Preparing context",
            message: "Extracting canonical document and filtering selected findings...",
          });

          const onProgress = (stage: string) => {
            const mappedStage: UXOptimizationStage =
              stage.includes("Analyzing")
                ? "Analyzing selected findings"
                : stage.includes("Generating") || stage.includes("implementation")
                ? "Generating optimization"
                : stage.includes("Validating") || stage.includes("Sanitizing")
                ? "Sanitizing candidate"
                : "Generating optimization";

            sendEvent({
              type: "status",
              stage: mappedStage,
              message: stage,
            });
          };

          let rawResult;
          try {
            rawResult = await provider.generate(genRequest, {
              signal: req.signal,
              onProgress,
            });
          } catch (err) {
            if (provider instanceof MockPageGenerationProvider) {
              throw err;
            }
            const fallbackProvider = new MockPageGenerationProvider();
            rawResult = await fallbackProvider.generate(genRequest, {
              signal: req.signal,
              onProgress,
            });
          }

          sendEvent({
            type: "status",
            stage: "Sanitizing candidate",
            message: "Sanitizing generated candidate through HTML security sanitizer...",
          });

          const sanitized = sanitizeGeneratedHtml(rawResult.html);
          const candidateSummary = buildOptimizationCandidateSummary(
            optimizationRequest.selectedFindings
          );

          const finalResult = {
            ...rawResult,
            summary: candidateSummary,
            html: sanitized.sanitizedHtml,
            validation: {
              valid: sanitized.isValid,
              diagnostics: sanitized.diagnostics,
            },
          };

          sendEvent({
            type: "result",
            result: finalResult,
          });

          sendEvent({
            type: "status",
            stage: "Complete",
            message: "Candidate ready for preview.",
          });

          sendEvent({
            type: "complete",
          });

          controller.close();
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to generate optimization candidate";
          sendEvent({
            type: "error",
            error: errorMessage,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Internal server error during optimization candidate generation.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
