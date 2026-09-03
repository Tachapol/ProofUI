import { AIEditRequest, AIEditProposal } from "./schemas";

export interface AIEditProvider {
  generateEdit(
    request: AIEditRequest,
    options?: {
      signal?: AbortSignal;
    }
  ): Promise<AIEditProposal>;
}
