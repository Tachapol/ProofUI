import { DocumentVersion, DocumentVersionSource } from "./schemas";

export interface CreateVersionParams {
  parentVersionId: string | null;
  source: DocumentVersionSource;
  revision: number;
  htmlReference: string;
  conversationId?: string;
  messageId?: string;
  instruction?: string;
  summary: string;
}

export function createDocumentVersion(params: CreateVersionParams): DocumentVersion {
  return {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    parentVersionId: params.parentVersionId,
    source: params.source,
    revision: params.revision,
    htmlReference: params.htmlReference,
    conversationId: params.conversationId,
    messageId: params.messageId,
    instruction: params.instruction,
    summary: params.summary,
    createdAt: new Date().toISOString(),
  };
}

export function restoreVersionToHead(
  versions: DocumentVersion[],
  targetVersionId: string,
  newRevision: number
): { restoredVersion: DocumentVersion; targetVersion: DocumentVersion } | null {
  const target = versions.find((v) => v.id === targetVersionId);
  if (!target) return null;

  const currentHead = versions[versions.length - 1] || null;

  const restoredVersion = createDocumentVersion({
    parentVersionId: currentHead ? currentHead.id : null,
    source: "restored",
    revision: newRevision,
    htmlReference: target.htmlReference,
    summary: `Restored to version ${target.id.slice(0, 10)} (${target.summary})`,
  });

  return {
    restoredVersion,
    targetVersion: target,
  };
}
