import { describe, it, expect, beforeEach } from "vitest";
import {
  saveDocumentToStorage,
  loadDocumentFromStorage,
  clearDocumentFromStorage,
} from "../../src/lib/editor/persistence";
import { EDITOR_CONFIG } from "../../src/lib/editor/constants";

describe("LocalStorage Document Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads document with schema version verification", () => {
    const html = "<!DOCTYPE html><html><body><h1>Saved Document</h1></body></html>";
    const saved = saveDocumentToStorage(html);
    expect(saved).toBe(true);

    const loaded = loadDocumentFromStorage();
    expect(loaded).toBe(html);
  });

  it("safely handles corrupted or invalid JSON in storage", () => {
    localStorage.setItem(EDITOR_CONFIG.STORAGE_KEY, "{ broken json ... ");
    const loaded = loadDocumentFromStorage();
    expect(loaded).toBeNull();
  });

  it("ignores stored payload with outdated schema version", () => {
    const outdatedPayload = {
      version: 999, // Incompatible version
      source: "<h1>Outdated</h1>",
      timestamp: Date.now(),
    };
    localStorage.setItem(EDITOR_CONFIG.STORAGE_KEY, JSON.stringify(outdatedPayload));

    const loaded = loadDocumentFromStorage();
    expect(loaded).toBeNull();
  });

  it("clears document from storage", () => {
    saveDocumentToStorage("<p>Test</p>");
    expect(loadDocumentFromStorage()).toBe("<p>Test</p>");

    clearDocumentFromStorage();
    expect(loadDocumentFromStorage()).toBeNull();
  });
});
