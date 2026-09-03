import OpenAI from "openai";
import { PageGenerationProvider } from "./provider";
import {
  PageGenerationRequest,
  PageGenerationResult,
  QwenGenerationOutputSchema,
  GenerationErrorCode,
} from "./schemas";
import { buildNormalizedContext } from "./source-precedence";
import { sanitizeGeneratedHtml } from "./sanitizer";
import { resolveScreenshotReference, ScreenshotResolutionError } from "./screenshot-resolver";
import { buildQwenMessages, buildQwenResponseSchema } from "./qwen-context-builder";

/**
 * Typed error for generation failures with safe error codes.
 */
export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: GenerationErrorCode
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

/**
 * Configuration read from server-side environment variables.
 * Never exposed to client code.
 */
export interface QwenConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export function loadQwenConfig(): QwenConfig {
  const apiKey = process.env.AI_API_KEY || process.env.DASHSCOPE_API_KEY;
  const baseURL = process.env.AI_BASE_URL || process.env.QWEN_BASE_URL;
  const model = process.env.AI_MODEL || process.env.QWEN_MODEL;

  if (!apiKey) {
    throw new GenerationError(
      "AI provider API key is not configured. Set AI_API_KEY in server environment.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }
  if (!baseURL) {
    throw new GenerationError(
      "AI provider base URL is not configured. Set AI_BASE_URL in server environment.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }
  if (!model) {
    throw new GenerationError(
      "AI model is not configured. Set AI_MODEL in server environment.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }

  return { apiKey, baseURL, model };
}

/**
 * Map OpenAI SDK errors to safe GenerationErrorCode values.
 */
function mapApiError(err: unknown): GenerationError {
  if (err instanceof GenerationError) return err;
  if (err instanceof ScreenshotResolutionError) {
    return new GenerationError(err.message, err.code);
  }

  if (err instanceof OpenAI.APIError) {
    if (err.status === 401 || err.status === 403) {
      return new GenerationError(
        "AI provider authentication failed. Check your API key.",
        "PROVIDER_AUTHENTICATION_FAILED"
      );
    }
    if (err.status === 429) {
      return new GenerationError(
        "AI provider rate limit exceeded. Please try again later.",
        "PROVIDER_RATE_LIMITED"
      );
    }
    if (err.status === 408 || err.code === "timeout") {
      return new GenerationError(
        "AI provider request timed out. Please try again.",
        "PROVIDER_TIMEOUT"
      );
    }
    return new GenerationError(
      "AI provider request failed. Please try again.",
      "PROVIDER_REQUEST_FAILED"
    );
  }

  if (err instanceof Error && err.name === "AbortError") {
    return new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
  }

  return new GenerationError(
    "An unexpected error occurred during generation.",
    "PROVIDER_REQUEST_FAILED"
  );
}

export class QwenPageGenerationProvider implements PageGenerationProvider {
  private config: QwenConfig;
  private client?: OpenAI;

  constructor(options: { config?: QwenConfig; client?: OpenAI } = {}) {
    this.config = options.config ?? loadQwenConfig();
    this.client = options.client;
  }

  async generate(
    request: PageGenerationRequest,
    options: {
      signal?: AbortSignal;
      onProgress?: (stage: string) => void;
    } = {}
  ): Promise<PageGenerationResult> {
    const { onProgress, signal } = options;

    if (signal?.aborted) {
      throw new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
    }

    try {
      const client =
        this.client ??
        new OpenAI({
          apiKey: this.config.apiKey,
          baseURL: this.config.baseURL,
        });

      // 1. Prepare context
      onProgress?.("Preparing context");
      const normalized = buildNormalizedContext(request);

      // 2. Resolve screenshot if provided
      let screenshotDataUrl: string | undefined;
      if (request.context.screenshotReference) {
        onProgress?.("Reading screenshot reference");
        try {
          const resolved = await resolveScreenshotReference(
            request.context.screenshotReference
          );
          screenshotDataUrl = resolved.dataUrl;
        } catch (err) {
          if (err instanceof ScreenshotResolutionError) {
            // Non-fatal: proceed without screenshot, add warning
            normalized.sourcePrecedence.sources =
              normalized.sourcePrecedence.sources.filter(
                (s) => s.sourceId !== "capture-screenshot"
              );
          } else {
            throw err;
          }
        }
      }

      if (signal?.aborted) {
        throw new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
      }

      // 3. Build Qwen messages
      onProgress?.("Generating implementation");
      const createCompletion = (includeScreenshot: boolean) => {
        const messages = buildQwenMessages(
          normalized,
          includeScreenshot ? screenshotDataUrl : undefined
        );
        return client.chat.completions.create(
          {
            model: this.config.model,
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content,
            })) as OpenAI.ChatCompletionMessageParam[],
            response_format: buildQwenResponseSchema(),
            temperature: 0.7,
            max_tokens: 16384,
          },
          { signal }
        );
      };

      // 4. Call Qwen API. Some OpenAI-compatible gateways expose text-only Qwen
      // models under the same endpoint, so retry without the image only when the
      // provider explicitly rejects image input.
      let usedTextOnlyFallback = false;
      let completion;
      try {
        completion = await createCompletion(Boolean(screenshotDataUrl));
      } catch (error) {
        const providerMessage =
          error instanceof Error ? error.message.toLowerCase() : "";
        const isImageInputRejected =
          Boolean(screenshotDataUrl) &&
          error instanceof OpenAI.APIError &&
          error.status === 400 &&
          /(image|vision|multimodal|image_url)/.test(providerMessage);
        if (!isImageInputRejected) throw error;

        onProgress?.("Provider does not support images; retrying with text context");
        completion = await createCompletion(false);
        usedTextOnlyFallback = true;
      }

      if (signal?.aborted) {
        throw new GenerationError("Generation was canceled.", "GENERATION_CANCELED");
      }

      // 5. Parse response
      const rawContent = completion.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new GenerationError(
          "AI provider returned empty response.",
          "PROVIDER_INVALID_OUTPUT"
        );
      }

      // Strip potential markdown fences and thinking tags
      let jsonContent = rawContent.trim();
      // Remove <think>...</think> blocks if present
      jsonContent = jsonContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      // Remove markdown code fences
      if (jsonContent.startsWith("```")) {
        jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(jsonContent);
      } catch {
        throw new GenerationError(
          "AI provider returned invalid JSON.",
          "PROVIDER_INVALID_OUTPUT"
        );
      }

      // 6. Validate with Zod
      onProgress?.("Validating generated HTML");
      const zodResult = QwenGenerationOutputSchema.safeParse(parsedOutput);
      if (!zodResult.success) {
        throw new GenerationError(
          "AI provider output does not match expected schema.",
          "PROVIDER_INVALID_OUTPUT"
        );
      }

      const qwenOutput = zodResult.data;

      // 7. Output size guard
      if (qwenOutput.html.length > 500_000) {
        throw new GenerationError(
          "Generated HTML exceeds maximum allowed size.",
          "GENERATED_HTML_INVALID"
        );
      }

      // 8. Sanitize through existing pipeline
      const sanitized = sanitizeGeneratedHtml(qwenOutput.html);
      if (!sanitized.isValid) {
        throw new GenerationError(
          "Generated HTML failed validation after sanitization.",
          "GENERATED_HTML_INVALID"
        );
      }

      onProgress?.("Preparing preview");

      const allWarnings = [...qwenOutput.warnings];
      if (!screenshotDataUrl && request.context.screenshotReference) {
        allWarnings.push(
          "Screenshot could not be resolved. Generation used text-only context."
        );
      }
      if (usedTextOnlyFallback) {
        allWarnings.push(
          "The configured model rejected image input. Generation continued with extracted structure, tokens, and text context."
        );
      }

      onProgress?.("Ready for review");

      return {
        id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        requestId: request.requestId,
        conversationId: request.conversationId,
        basedOnRevision: request.basedOnRevision,
        scope: request.scope,
        summary: qwenOutput.summary,
        html: sanitized.sanitizedHtml,
        warnings: allWarnings,
        attachmentIds: request.attachmentIds,
        sourcePrecedence: normalized.sourcePrecedence,
        validation: {
          valid: sanitized.isValid,
          diagnostics: sanitized.diagnostics,
        },
        providerName: "qwen",
        modelName: this.config.model,
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      throw mapApiError(err);
    }
  }
}
