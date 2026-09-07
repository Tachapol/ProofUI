import { PageGenerationProvider } from "./provider";
import {
  PageGenerationRequest,
  PageGenerationResult,
  QwenGenerationOutputSchema,
} from "./schemas";
import { buildNormalizedContext } from "./source-precedence";
import { sanitizeGeneratedHtml } from "./sanitizer";
import { resolveScreenshotReference, ScreenshotResolutionError } from "./screenshot-resolver";
import { buildQwenMessages, QwenContentPart } from "./qwen-context-builder";
import { GenerationError } from "./qwen-provider";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export interface GeminiConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

type GeminiFetch = typeof fetch;

class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "GeminiHttpError";
  }
}

export function loadGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GenerationError(
      "Gemini API key is not configured. Set GEMINI_API_KEY in server environment.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }

  return {
    apiKey,
    baseURL: (process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL).replace(/\/$/, ""),
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  };
}

function buildGeminiResponseSchema() {
  return {
    type: "OBJECT",
    properties: {
      summary: { type: "STRING" },
      html: { type: "STRING" },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: ["summary", "html", "warnings"],
  };
}

function toGeminiPart(part: QwenContentPart): { text: string } | {
  inlineData: { mimeType: string; data: string };
} {
  if (part.type === "text") return { text: part.text };

  const match = part.image_url.url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new GenerationError("Screenshot data could not be prepared for Gemini.", "ATTACHMENT_NOT_FOUND");
  }
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

function mapGeminiError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;
  if (error instanceof ScreenshotResolutionError) return new GenerationError(error.message, error.code);
  if (error instanceof Error && error.name === "AbortError") {
    return new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
  }
  if (error instanceof GeminiHttpError) {
    if (error.status === 401 || error.status === 403) {
      return new GenerationError("Gemini authentication failed. Check your API key.", "PROVIDER_AUTHENTICATION_FAILED");
    }
    if (error.status === 429) {
      return new GenerationError("Gemini rate limit exceeded. Please try again later.", "PROVIDER_RATE_LIMITED");
    }
    if (error.status === 408 || error.status === 504) {
      return new GenerationError("Gemini request timed out. Please try again.", "PROVIDER_TIMEOUT");
    }
  }
  return new GenerationError("Gemini request failed. Please try again.", "PROVIDER_REQUEST_FAILED");
}

export class GeminiPageGenerationProvider implements PageGenerationProvider {
  private config: GeminiConfig;
  private fetchImpl: GeminiFetch;

  constructor(options: { config?: GeminiConfig; fetchImpl?: GeminiFetch } = {}) {
    this.config = options.config ?? loadGeminiConfig();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async generateContent(
    normalized: ReturnType<typeof buildNormalizedContext>,
    screenshotDataUrl: string | undefined,
    signal: AbortSignal | undefined
  ): Promise<string> {
    const messages = buildQwenMessages(normalized, screenshotDataUrl);
    const systemInstruction = messages[0]?.content;
    const userContent = messages[1]?.content;
    if (typeof systemInstruction !== "string" || !Array.isArray(userContent)) {
      throw new GenerationError("Gemini prompt could not be prepared.", "PROVIDER_REQUEST_FAILED");
    }

    const response = await this.fetchImpl(
      `${this.config.baseURL}/models/${encodeURIComponent(this.config.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: userContent.map(toGeminiPart) }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema: buildGeminiResponseSchema(),
          },
        }),
      }
    );

    if (!response.ok) {
      // Do not surface the raw provider body: it can contain request diagnostics.
      throw new GeminiHttpError(response.status, "Gemini request was rejected.");
    }

    const payload: unknown = await response.json().catch(() => null);
    const candidate = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) {
      throw new GenerationError("Gemini returned empty output.", "PROVIDER_INVALID_OUTPUT");
    }
    return text;
  }

  async generate(
    request: PageGenerationRequest,
    options: { signal?: AbortSignal; onProgress?: (stage: string) => void } = {}
  ): Promise<PageGenerationResult> {
    const { signal, onProgress } = options;
    if (signal?.aborted) throw new GenerationError("Generation was canceled.", "GENERATION_CANCELED");

    try {
      onProgress?.("Preparing context");
      const normalized = buildNormalizedContext(request);
      let screenshotDataUrl: string | undefined;

      if (request.context.screenshotReference) {
        onProgress?.("Reading screenshot reference");
        try {
          screenshotDataUrl = (await resolveScreenshotReference(request.context.screenshotReference)).dataUrl;
        } catch (error) {
          if (!(error instanceof ScreenshotResolutionError)) throw error;
          normalized.sourcePrecedence.sources = normalized.sourcePrecedence.sources.filter(
            (source) => source.sourceId !== "capture-screenshot"
          );
        }
      }

      onProgress?.("Generating implementation");
      let usedTextOnlyFallback = false;
      let rawContent: string;
      try {
        rawContent = await this.generateContent(normalized, screenshotDataUrl, signal);
      } catch (error) {
        const imageRejected =
          Boolean(screenshotDataUrl) &&
          error instanceof GeminiHttpError &&
          error.status === 400;
        if (!imageRejected) throw error;
        onProgress?.("Gemini does not support images; retrying with text context");
        rawContent = await this.generateContent(normalized, undefined, signal);
        usedTextOnlyFallback = true;
      }

      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(rawContent.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new GenerationError("Gemini returned invalid JSON.", "PROVIDER_INVALID_OUTPUT");
      }

      onProgress?.("Validating generated HTML");
      const parsed = QwenGenerationOutputSchema.safeParse(parsedOutput);
      if (!parsed.success) {
        throw new GenerationError("Gemini output does not match expected schema.", "PROVIDER_INVALID_OUTPUT");
      }
      if (parsed.data.html.length > 500_000) {
        throw new GenerationError("Generated HTML exceeds maximum allowed size.", "GENERATED_HTML_INVALID");
      }

      const sanitized = sanitizeGeneratedHtml(parsed.data.html);
      if (!sanitized.isValid) {
        throw new GenerationError("Generated HTML failed validation after sanitization.", "GENERATED_HTML_INVALID");
      }

      const warnings = [...parsed.data.warnings];
      if (!screenshotDataUrl && request.context.screenshotReference) {
        warnings.push("Screenshot could not be resolved. Generation used text-only context.");
      }
      if (usedTextOnlyFallback) {
        warnings.push("The configured Gemini model rejected image input. Generation continued with text context.");
      }

      onProgress?.("Preparing preview");
      onProgress?.("Ready for review");
      return {
        id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        requestId: request.requestId,
        conversationId: request.conversationId,
        basedOnRevision: request.basedOnRevision,
        scope: request.scope,
        summary: parsed.data.summary,
        html: sanitized.sanitizedHtml,
        warnings,
        attachmentIds: request.attachmentIds,
        sourcePrecedence: normalized.sourcePrecedence,
        validation: { valid: sanitized.isValid, diagnostics: sanitized.diagnostics },
        providerName: "gemini",
        modelName: this.config.model,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      throw mapGeminiError(error);
    }
  }
}
