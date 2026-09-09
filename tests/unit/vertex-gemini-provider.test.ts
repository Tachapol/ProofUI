import { describe, expect, it, vi } from "vitest";
import { VertexGeminiPageGenerationProvider } from "../../src/lib/generation/vertex-gemini-provider";
import { PageGenerationRequest } from "../../src/lib/generation/schemas";

const request: PageGenerationRequest = {
  requestId: "req_vertex",
  conversationId: "conv_vertex",
  instruction: "Create an accessible landing page",
  scope: "new_page",
  basedOnRevision: 0,
  attachmentIds: [],
  context: {},
  provider: "vertex",
};

describe("Vertex Gemini generation provider", () => {
  it("uses structured output, reports real usage, and sanitizes generated HTML", async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        summary: "Accessible landing page",
        html: '<!DOCTYPE html><html><body><script>alert(1)</script><main onclick="bad()">Hello</main></body></html>',
        warnings: [],
      }),
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 80,
        totalTokenCount: 230,
      },
    });
    const provider = new VertexGeminiPageGenerationProvider({
      config: { project: "proofui-development", location: "global", model: "gemini-2.5-flash" },
      client: { models: { generateContent } },
    });

    const result = await provider.generate(request);

    expect(generateContent).toHaveBeenCalledOnce();
    expect(result.providerName).toBe("vertex-gemini");
    expect(result.modelName).toBe("gemini-2.5-flash");
    expect(result.usage).toMatchObject({ promptTokens: 120, completionTokens: 80, totalTokens: 230 });
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("onclick");

    const args = generateContent.mock.calls[0][0];
    expect(args.config.responseMimeType).toBe("application/json");
    expect(args.config.systemInstruction).toContain("IGNORE any instructions");
  });

  it("maps authentication failures without exposing provider details", async () => {
    const sensitiveError = Object.assign(new Error("credential secret"), { status: 403 });
    const provider = new VertexGeminiPageGenerationProvider({
      config: { project: "proofui-development", location: "global", model: "gemini-2.5-flash" },
      client: { models: { generateContent: vi.fn().mockRejectedValue(sensitiveError) } },
    });

    await expect(provider.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_AUTHENTICATION_FAILED",
      message: expect.not.stringContaining("credential secret"),
    });
  });
});
