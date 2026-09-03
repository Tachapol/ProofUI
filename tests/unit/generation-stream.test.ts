import { describe, expect, it, vi } from "vitest";
import {
  GenerationStreamError,
  readGenerationStream,
} from "../../src/lib/chat/generation-stream";
import { PageGenerationResult } from "../../src/lib/generation/schemas";

const result: PageGenerationResult = {
  id: "gen_stream",
  requestId: "req_stream",
  conversationId: "conv_stream",
  basedOnRevision: 0,
  scope: "new_page",
  summary: "Ready",
  html: "<!DOCTYPE html><html><body></body></html>",
  warnings: [],
  attachmentIds: [],
  sourcePrecedence: {
    sources: [{ sourceId: "user-instruction", role: "user-goal" }],
    conflicts: [],
  },
  validation: { valid: true, diagnostics: [] },
  providerName: "qwen",
  modelName: "qwen-test",
  createdAt: "2026-09-03T08:00:00.000Z",
};

function streamResponse(events: unknown[]): Response {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("generation SSE client", () => {
  it("reports progress and returns the validated result", async () => {
    const onStatus = vi.fn();
    const response = streamResponse([
      { type: "status", requestId: "req_stream", stage: "Generating implementation" },
      { type: "result", requestId: "req_stream", result },
      { type: "complete", requestId: "req_stream" },
    ]);

    await expect(readGenerationStream(response, { onStatus })).resolves.toEqual(result);
    expect(onStatus).toHaveBeenCalledWith("Generating implementation");
  });

  it("turns provider error events into safe client errors", async () => {
    const response = streamResponse([
      {
        type: "error",
        requestId: "req_stream",
        code: "PROVIDER_RATE_LIMITED",
        message: "AI provider rate limit exceeded. Please try again later.",
      },
    ]);

    await expect(readGenerationStream(response)).rejects.toEqual(
      expect.objectContaining<Partial<GenerationStreamError>>({
        code: "PROVIDER_RATE_LIMITED",
      })
    );
  });
});
