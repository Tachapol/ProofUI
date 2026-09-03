import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  saveDocumentToStorage,
  loadDocumentFromStorage,
  clearDocumentFromStorage,
  StoredEditorProject,
  CURRENT_SCHEMA_VERSION,
  PROJECT_STORAGE_KEY,
  LEGACY_STORAGE_KEY_V2,
} from "../../src/lib/editor/persistence";

describe("Document Context Persistence & Migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores full project document context separately from HTML", () => {
    const project: StoredEditorProject = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      document: {
        source: "<html><body><h1>Hello Context</h1></body></html>",
        revision: 3,
        context: {
          title: "Imported SaaS Site",
          sourceUrl: "https://example.com",
          designMarkdown: "# Design Tokens\nPrimary: #2563eb",
          capturePackageId: "cap_12345",
          screenshotReference: "/api/imports/cap_12345/screenshot",
        },
      },
      conversations: [],
      messages: [],
      versions: [],
      activeConversationId: null,
      sidebar: { width: 400, isCollapsed: false },
      timestamp: Date.now(),
    };

    const saved = saveProjectToStorage(project);
    expect(saved).toBe(true);

    const loaded = loadProjectFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.document.source).toBe("<html><body><h1>Hello Context</h1></body></html>");
    expect(loaded?.document.revision).toBe(3);
    expect(loaded?.document.context.title).toBe("Imported SaaS Site");
    expect(loaded?.document.context.sourceUrl).toBe("https://example.com");
    expect(loaded?.document.context.designMarkdown).toContain("# Design Tokens");
    expect(loaded?.document.context.screenshotReference).toBe("/api/imports/cap_12345/screenshot");
    expect(loaded?.sidebar?.width).toBe(400);
  });

  it("migrates legacy v2 HTML-only storage without data loss", () => {
    const legacyHtml = "<html><body><h2>Legacy Page</h2></body></html>";
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY_V2,
      JSON.stringify({
        version: 2,
        source: legacyHtml,
        timestamp: Date.now() - 10000,
      })
    );

    // Initial load should detect and migrate legacy format
    const loaded = loadProjectFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(loaded?.document.source).toBe(legacyHtml);
    expect(loaded?.document.context.title).toBe("Migrated Document");

    // After migration, the new key should exist in storage
    expect(window.localStorage.getItem(PROJECT_STORAGE_KEY)).not.toBeNull();
  });

  it("safely recovers from corrupted localStorage payload", () => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, "{ broken json ... !");

    const loaded = loadProjectFromStorage();
    expect(loaded).toBeNull();

    // Able to save cleanly over corrupt state
    const saved = saveDocumentToStorage("<html><body>Recovered</body></html>", 1);
    expect(saved).toBe(true);
    expect(loadDocumentFromStorage()).toBe("<html><body>Recovered</body></html>");
  });

  it("clears both new project key and legacy key upon clearDocumentFromStorage", () => {
    saveDocumentToStorage("<html><body>To Clear</body></html>", 1);
    expect(window.localStorage.getItem(PROJECT_STORAGE_KEY)).not.toBeNull();

    clearDocumentFromStorage();
    expect(window.localStorage.getItem(PROJECT_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY_V2)).toBeNull();
    expect(loadDocumentFromStorage()).toBeNull();
  });
});
