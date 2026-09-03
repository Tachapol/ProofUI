import {
  GenerationStreamEventSchema,
  PageGenerationResult,
} from "../generation/schemas";

export class GenerationStreamError extends Error {
  constructor(
    message: string,
    public readonly code = "PROVIDER_REQUEST_FAILED"
  ) {
    super(message);
    this.name = "GenerationStreamError";
  }
}

interface GenerationStreamHandlers {
  onStatus?: (stage: string) => void;
}

export async function readGenerationStream(
  response: Response,
  handlers: GenerationStreamHandlers = {}
): Promise<PageGenerationResult> {
  if (!response.body) {
    throw new GenerationStreamError("Generation stream was unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: PageGenerationResult | undefined;
  let completed = false;

  const processBlock = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;

    let rawEvent: unknown;
    try {
      rawEvent = JSON.parse(data);
    } catch {
      throw new GenerationStreamError("Generation stream returned invalid data.");
    }

    const parsed = GenerationStreamEventSchema.safeParse(rawEvent);
    if (!parsed.success) {
      throw new GenerationStreamError("Generation stream returned an invalid event.");
    }

    const event = parsed.data;
    if (event.type === "status") handlers.onStatus?.(event.stage);
    if (event.type === "result") result = event.result;
    if (event.type === "error") {
      throw new GenerationStreamError(event.message, event.code);
    }
    if (event.type === "complete") completed = true;
  };

  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) processBlock(block);
      if (done) break;
    }
    if (buffer.trim()) processBlock(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw new GenerationStreamError("Generation completed without a result.");
  }
  return result;
}
