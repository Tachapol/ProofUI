import { PageGenerationProvider } from "./provider";
import { MockPageGenerationProvider } from "./mock-provider";
import { QwenPageGenerationProvider } from "./qwen-provider";
import { GeminiPageGenerationProvider } from "./gemini-provider";
import { VertexGeminiPageGenerationProvider } from "./vertex-gemini-provider";
import { GenerationError } from "./qwen-provider";

/**
 * Server-side factory for generation providers.
 * The provider can be specified by the client or fall back to AI_PROVIDER environment variable.
 */
export function createGenerationProvider(provider?: "vertex" | "qwen" | "gemini" | "mock"): PageGenerationProvider {
  if (process.env.PROOF_UI_ENABLE_TEST_FIXTURES === "true") {
    return new MockPageGenerationProvider();
  }

  const selectedProvider = provider ?? process.env.AI_PROVIDER;

  switch (selectedProvider) {
    case "vertex":
      return new VertexGeminiPageGenerationProvider();

    case "qwen":
      return new QwenPageGenerationProvider();

    case "gemini":
      return new GeminiPageGenerationProvider();

    case "mock":
    case undefined:
    case "":
      return new MockPageGenerationProvider();

    default:
      throw new GenerationError(
        `Unsupported AI provider: "${selectedProvider}". Use "vertex", "gemini", "qwen", or "mock".`,
        "PROVIDER_NOT_CONFIGURED"
      );
  }
}
