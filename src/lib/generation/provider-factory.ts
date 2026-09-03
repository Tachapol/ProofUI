import { PageGenerationProvider } from "./provider";
import { MockPageGenerationProvider } from "./mock-provider";
import { QwenPageGenerationProvider } from "./qwen-provider";

/**
 * Server-side factory for generation providers.
 * The provider is determined by the AI_PROVIDER environment variable.
 * The client cannot choose or influence provider selection.
 */
export function createGenerationProvider(): PageGenerationProvider {
  const provider = process.env.AI_PROVIDER;

  switch (provider) {
    case "qwen":
      return new QwenPageGenerationProvider();

    case "mock":
    case undefined:
    case "":
      return new MockPageGenerationProvider();

    default:
      throw new Error(`Unsupported AI_PROVIDER: "${provider}". Use "qwen" or "mock".`);
  }
}
