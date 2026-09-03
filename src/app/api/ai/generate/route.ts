import { NextRequest, NextResponse } from "next/server";
import { PageGenerationRequestSchema, GenerationStreamEvent } from "@/lib/generation/schemas";
import { createGenerationProvider } from "@/lib/generation/provider-factory";
import { GenerationError } from "@/lib/generation/qwen-provider";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = PageGenerationRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid generation request.",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const request = parseResult.data;

    let provider;
    try {
      provider = createGenerationProvider();
    } catch (err) {
      if (err instanceof GenerationError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Failed to initialize AI provider." },
        { status: 500 }
      );
    }

    // Check if client requests streaming
    const acceptHeader = req.headers.get("accept") || "";
    const wantsStream = acceptHeader.includes("text/event-stream");

    if (!wantsStream) {
      // Non-streaming fallback
      try {
        const result = await provider.generate(request, { signal: req.signal });
        return NextResponse.json({ result });
      } catch (err) {
        if (err instanceof GenerationError) {
          const status =
            err.code === "PROVIDER_NOT_CONFIGURED" ? 503
              : err.code === "PROVIDER_AUTHENTICATION_FAILED" ? 401
              : err.code === "PROVIDER_RATE_LIMITED" ? 429
              : err.code === "PROVIDER_TIMEOUT" ? 504
              : 500;
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status }
          );
        }
        return NextResponse.json(
          { error: "Generation failed." },
          { status: 500 }
        );
      }
    }

    // Streaming response with ReadableStream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: GenerationStreamEvent) => {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        };

        try {
          const result = await provider.generate(request, {
            signal: req.signal,
            onProgress: (stage: string) => {
              sendEvent({
                type: "status",
                requestId: request.requestId,
                stage,
              });
            },
          });

          sendEvent({
            type: "result",
            requestId: request.requestId,
            result,
          });

          sendEvent({
            type: "complete",
            requestId: request.requestId,
          });

          controller.close();
        } catch (error) {
          const code =
            error instanceof GenerationError ? error.code : "PROVIDER_REQUEST_FAILED";
          const message =
            error instanceof GenerationError
              ? error.message
              : "Generation failed";

          sendEvent({
            type: "error",
            requestId: request.requestId,
            code,
            message,
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
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
