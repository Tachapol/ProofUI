import { GoogleGenAI } from "@google/genai";
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

const DEFAULT_VERTEX_MODEL = "gemini-2.5-flash";
const DEFAULT_VERTEX_LOCATION = "global";
const MAX_RETRIES = 2;

export interface VertexGeminiConfig {
  project: string;
  location: string;
  model: string;
}

interface VertexGenerateResponse {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface VertexClient {
  models: {
    generateContent(args: Record<string, unknown>): Promise<VertexGenerateResponse>;
  };
}

function loadVertexConfig(): VertexGeminiConfig {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    throw new GenerationError(
      "Vertex AI project is not configured. Set GOOGLE_CLOUD_PROJECT in the server environment.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }

  return {
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION || DEFAULT_VERTEX_LOCATION,
    model: process.env.VERTEX_AI_MODEL || DEFAULT_VERTEX_MODEL,
  };
}

function buildResponseSchema() {
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

function toVertexPart(part: QwenContentPart): { text: string } | {
  inlineData: { mimeType: string; data: string };
} {
  if (part.type === "text") return { text: part.text };
  const match = part.image_url.url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new GenerationError("Screenshot data could not be prepared for Vertex AI.", "ATTACHMENT_NOT_FOUND");
  }
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const value = candidate.status ?? candidate.code;
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  return undefined;
}

function mapVertexError(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error;
  if (error instanceof ScreenshotResolutionError) return new GenerationError(error.message, error.code);
  if (error instanceof Error && error.name === "AbortError") {
    return new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
  }

  const status = statusFromError(error);
  if (status === 401 || status === 403) {
    return new GenerationError(
      "Vertex AI authentication failed. Check ADC, project access, and the Vertex AI API.",
      "PROVIDER_AUTHENTICATION_FAILED"
    );
  }
  if (status === 429) {
    return new GenerationError(
      "Vertex Gemini is temporarily busy. Try again shortly or continue with Qwen.",
      "PROVIDER_RATE_LIMITED"
    );
  }
  if (status === 408 || status === 504) {
    return new GenerationError("Vertex AI request timed out. Please try again.", "PROVIDER_TIMEOUT");
  }
  return new GenerationError("Vertex AI request failed. Please try again.", "PROVIDER_REQUEST_FAILED");
}

function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export class VertexGeminiPageGenerationProvider implements PageGenerationProvider {
  private readonly config: VertexGeminiConfig;
  private readonly client: VertexClient;

  constructor(options: { config?: VertexGeminiConfig; client?: VertexClient } = {}) {
    this.config = options.config ?? loadVertexConfig();
    this.client = options.client ?? new GoogleGenAI({
      vertexai: true,
      project: this.config.project,
      location: this.config.location,
    }) as unknown as VertexClient;
  }

  private async generateContent(
    normalized: ReturnType<typeof buildNormalizedContext>,
    screenshotDataUrl: string | undefined,
    signal: AbortSignal | undefined,
    onProgress?: (stage: string) => void
  ): Promise<VertexGenerateResponse> {
    const messages = buildQwenMessages(normalized, screenshotDataUrl);
    const systemInstruction = messages[0]?.content;
    const userContent = messages[1]?.content;
    if (typeof systemInstruction !== "string" || !Array.isArray(userContent)) {
      throw new GenerationError("Vertex AI prompt could not be prepared.", "PROVIDER_REQUEST_FAILED");
    }

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.client.models.generateContent({
          model: this.config.model,
          contents: [{ role: "user", parts: userContent.map(toVertexPart) }],
          config: {
            systemInstruction,
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema: buildResponseSchema(),
            abortSignal: signal,
          },
        });
      } catch (error) {
        if (statusFromError(error) !== 429 || attempt >= MAX_RETRIES) throw error;
        const delay = 500 * 2 ** attempt;
        onProgress?.(`Vertex AI is busy — retrying in ${delay / 1000}s`);
        await abortableDelay(delay, signal);
      }
    }
  }

  async generate(
    request: PageGenerationRequest,
    options: { signal?: AbortSignal; onProgress?: (stage: string) => void } = {}
  ): Promise<PageGenerationResult> {
    const { signal, onProgress } = options;
    const startedAt = Date.now();
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

      onProgress?.("Generating with Vertex Gemini");
      const response = await this.generateContent(normalized, screenshotDataUrl, signal, onProgress);
      const rawContent = response.text?.trim();
      if (!rawContent) {
        throw new GenerationError("Vertex AI returned empty output.", "PROVIDER_INVALID_OUTPUT");
      }

      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(rawContent.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new GenerationError("Vertex AI returned invalid JSON.", "PROVIDER_INVALID_OUTPUT");
      }

      onProgress?.("Validating generated HTML");
      const parsed = QwenGenerationOutputSchema.safeParse(parsedOutput);
      if (!parsed.success) {
        throw new GenerationError("Vertex AI output does not match expected schema.", "PROVIDER_INVALID_OUTPUT");
      }

      const sanitized = sanitizeGeneratedHtml(parsed.data.html);
      if (!sanitized.isValid) {
        throw new GenerationError("Generated HTML failed validation after sanitization.", "GENERATED_HTML_INVALID");
      }

      const warnings = [...parsed.data.warnings];
      if (!screenshotDataUrl && request.context.screenshotReference) {
        warnings.push("Screenshot could not be resolved. Generation used text-only context.");
      }

      const durationMs = Date.now() - startedAt;
      const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
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
        providerName: "vertex-gemini",
        modelName: this.config.model,
        createdAt: new Date().toISOString(),
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: response.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens,
          durationMs,
        },
        durationMs,
      };
    } catch (error) {
      throw mapVertexError(error);
    }
  }
}
