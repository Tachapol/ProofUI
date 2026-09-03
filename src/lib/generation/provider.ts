import { PageGenerationRequest, PageGenerationResult } from "./schemas";

export interface PageGenerationProvider {
  generate(
    request: PageGenerationRequest,
    options?: {
      signal?: AbortSignal;
      onProgress?: (stage: string) => void;
    }
  ): Promise<PageGenerationResult>;
}
