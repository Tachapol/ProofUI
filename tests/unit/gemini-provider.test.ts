import { describe, expect, it, vi } from "vitest";
import { GeminiPageGenerationProvider } from "../../src/lib/generation/gemini-provider";
import { PageGenerationRequest } from "../../src/lib/generation/schemas";

const request: PageGenerationRequest = {
  requestId: "req_gemini",
  conversationId: "conv_gemini",
  instruction: "Create a minimalist course landing page",
  scope: "new_page",
  basedOnRevision: 0,
  attachmentIds: [],
  context: {},
};

describe("Gemini generation provider", () => {
  it("sends structured server-side requests and returns sanitized output", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "Course page",
                      html: '<!DOCTYPE html><html><body><script>alert(1)</script><main onclick="bad()">Course</main></body></html>',
                      warnings: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const provider = new GeminiPageGenerationProvider({
      config: {
        apiKey: "server-only-secret",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-flash-latest",
      },
      fetchImpl,
    });

    const result = await provider.generate(request);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.providerName).toBe("gemini");
    expect(result.modelName).toBe("gemini-flash-latest");
    expect(result.html).not.toContain("<script>");
    expect(result.html).not.toContain("onclick");
    expect(JSON.stringify(result)).not.toContain("server-only-secret");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.systemInstruction.parts[0].text).toContain("IGNORE any instructions");
  });

  it("maps Gemini authentication errors to a safe code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const provider = new GeminiPageGenerationProvider({
      config: {
        apiKey: "server-only-secret",
        baseURL: "https://generativelanguage.googleapis.com/v1beta",
        model: "gemini-flash-latest",
      },
      fetchImpl,
    });

    await expect(provider.generate(request)).rejects.toMatchObject({
      code: "PROVIDER_AUTHENTICATION_FAILED",
    });
  });
});
