import { useState, useCallback } from "react";
import { DocumentVersion, DocumentVersionSource } from "./schemas";
import {
  createDocumentVersion,
  restoreVersionToHead,
} from "./version-manager";

export function useDocumentVersions(initialVersions: DocumentVersion[] = []) {
  const [versions, setVersions] = useState<DocumentVersion[]>(initialVersions);

  const addVersion = useCallback(
    (params: {
      source: DocumentVersionSource;
      revision: number;
      htmlReference: string;
      summary: string;
      parentVersionId?: string | null;
      conversationId?: string;
      messageId?: string;
      instruction?: string;
    }) => {
      const currentHead = versions[versions.length - 1] || null;
      const newVersion = createDocumentVersion({
        parentVersionId:
          params.parentVersionId !== undefined
            ? params.parentVersionId
            : currentHead
            ? currentHead.id
            : null,
        source: params.source,
        revision: params.revision,
        htmlReference: params.htmlReference,
        summary: params.summary,
        conversationId: params.conversationId,
        messageId: params.messageId,
        instruction: params.instruction,
      });

      setVersions((prev) => [...prev, newVersion]);
      return newVersion;
    },
    [versions]
  );

  const restoreVersion = useCallback(
    (targetVersionId: string, nextRevision: number) => {
      const result = restoreVersionToHead(versions, targetVersionId, nextRevision);
      if (!result) return null;

      setVersions((prev) => [...prev, result.restoredVersion]);
      return result;
    },
    [versions]
  );

  return {
    versions,
    setVersions,
    addVersion,
    restoreVersion,
  };
}
