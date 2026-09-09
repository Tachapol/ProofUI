import { EDITOR_CONFIG } from "./constants";
import { CapturePackage } from "../import/schemas";
import { Conversation, ChatMessage } from "../chat/schemas";
import { DocumentVersion } from "../generation/schemas";
import { ReviewState, ReviewStateSchema } from "../review/workflow";

export interface EditorDocumentContext {
  title: string;
  sourceUrl?: string;
  designMarkdown?: string;
  capturePackageId?: string;
  screenshotReference?: string;
  designTokens?: CapturePackage["designTokens"];
  structure?: CapturePackage["structure"];
  assets?: CapturePackage["assets"];
  evidence?: CapturePackage["evidence"];
  warnings?: CapturePackage["warnings"];
}

export interface StoredEditorProject {
  review?: ReviewState;
  schemaVersion: number;
  document: {
    source: string;
    revision: number;
    context: EditorDocumentContext;
  };
  conversations: Conversation[];
  messages: ChatMessage[];
  versions: DocumentVersion[];
  activeConversationId: string | null;
  sidebar?: {
    width: number;
    isCollapsed: boolean;
  };
  timestamp: number;
}

export const CURRENT_SCHEMA_VERSION = 3;
export const PROJECT_STORAGE_KEY = "proof_ui_editor_project_v3";
export const LEGACY_STORAGE_KEY_V2 = "proof_ui_document_v2";

export function getDefaultDocumentContext(title = "Landing Page"): EditorDocumentContext {
  return {
    title,
  };
}

export function saveProjectToStorage(project: StoredEditorProject): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const payload: StoredEditorProject = {
      ...project,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      timestamp: Date.now(),
    };
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn("Failed to save project to localStorage:", error);
    return false;
  }
}

export function loadProjectFromStorage(): StoredEditorProject | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  // 1. Try loading current v3 project
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<StoredEditorProject>;
      if (
        data.schemaVersion === CURRENT_SCHEMA_VERSION &&
        data.document &&
        typeof data.document.source === "string"
      ) {
        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          document: {
            source: data.document.source,
            revision: typeof data.document.revision === "number" ? data.document.revision : 0,
            context: data.document.context || getDefaultDocumentContext(),
          },
          conversations: Array.isArray(data.conversations) ? data.conversations : [],
          messages: Array.isArray(data.messages) ? data.messages : [],
          versions: Array.isArray(data.versions) ? data.versions : [],
          review: ReviewStateSchema.safeParse(data.review).success
            ? ReviewStateSchema.parse(data.review) : undefined,
          activeConversationId: data.activeConversationId || null,
          sidebar: data.sidebar || { width: 380, isCollapsed: false },
          timestamp: data.timestamp || Date.now(),
        };
      }
    }
  } catch (error) {
    console.warn("Failed to parse project from localStorage:", error);
  }

  // 2. Fallback: Migrate from legacy v2 storage key
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (legacyRaw) {
      const legacyData = JSON.parse(legacyRaw) as { version?: number; source?: string };
      if (
        legacyData.version === EDITOR_CONFIG.STORAGE_VERSION &&
        typeof legacyData.source === "string" &&
        legacyData.source.trim()
      ) {
        const migratedProject: StoredEditorProject = {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          document: {
            source: legacyData.source,
            revision: 0,
            context: getDefaultDocumentContext("Migrated Document"),
          },
          conversations: [],
          messages: [],
          versions: [],
          activeConversationId: null,
          sidebar: { width: 380, isCollapsed: false },
          timestamp: Date.now(),
        };
        // Persist migrated format
        saveProjectToStorage(migratedProject);
        return migratedProject;
      }
    }
  } catch (error) {
    console.warn("Failed to migrate legacy storage data:", error);
  }

  return null;
}

// Backwards-compatible document-only updater
export function saveDocumentToStorage(
  source: string,
  revision = 0,
  context?: Partial<EditorDocumentContext>
): boolean {
  const existingProject = loadProjectFromStorage();
  const projectToSave: StoredEditorProject = existingProject || {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    document: {
      source,
      revision,
      context: getDefaultDocumentContext(),
    },
    conversations: [],
    messages: [],
    versions: [],
    activeConversationId: null,
    sidebar: { width: 380, isCollapsed: false },
    timestamp: Date.now(),
  };

  projectToSave.document.source = source;
  projectToSave.document.revision = revision;
  if (context) {
    projectToSave.document.context = {
      ...projectToSave.document.context,
      ...context,
    };
  }

  // Maintain backwards-compatible legacy key as well
  try {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY_V2,
      JSON.stringify({
        version: EDITOR_CONFIG.STORAGE_VERSION,
        source,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore legacy key write error
  }

  return saveProjectToStorage(projectToSave);
}

export function loadDocumentFromStorage(): string | null {
  const project = loadProjectFromStorage();
  return project ? project.document.source : null;
}

export function clearDocumentFromStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_V2);
  } catch (error) {
    console.warn("Failed to clear project from localStorage:", error);
  }
}
