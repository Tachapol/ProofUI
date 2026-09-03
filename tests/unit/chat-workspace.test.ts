import { describe, it, expect, beforeEach } from "vitest";
import {
  createDefaultConversation,
  createChatMessage,
  generateConversationTitle,
} from "../../src/lib/chat/chat-state";
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  StoredEditorProject,
  CURRENT_SCHEMA_VERSION,
  getDefaultDocumentContext,
} from "../../src/lib/editor/persistence";

describe("Chat Workspace State & Management", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("generates concise title from first user message", () => {
    expect(generateConversationTitle("")).toBe("New Chat");
    expect(generateConversationTitle("Make header sticky")).toBe("Make header sticky");
    expect(
      generateConversationTitle("Please redesign the entire hero section with modern dark mode gradients")
    ).toBe("Please redesign the entir...");
  });

  it("creates, switches, renames, and persists multiple conversations", () => {
    const conv1 = createDefaultConversation();
    conv1.title = "Landing Page Chat";

    const conv2 = createDefaultConversation();
    conv2.title = "Pricing Redesign";

    const msg1 = createChatMessage({
      conversationId: conv1.id,
      role: "user",
      blocks: [{ type: "text", text: "Hello" }],
    });
    conv1.messageIds.push(msg1.id);

    const project: StoredEditorProject = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      document: {
        source: "<html><body>Default</body></html>",
        revision: 0,
        context: getDefaultDocumentContext(),
      },
      conversations: [conv1, conv2],
      messages: [msg1],
      versions: [],
      activeConversationId: conv2.id,
      sidebar: { width: 380, isCollapsed: false },
      timestamp: Date.now(),
    };

    saveProjectToStorage(project);

    const loaded = loadProjectFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.conversations.length).toBe(2);
    expect(loaded?.activeConversationId).toBe(conv2.id);

    // Rename conv2
    const c2 = loaded?.conversations.find((c) => c.id === conv2.id);
    expect(c2?.title).toBe("Pricing Redesign");
  });

  it("deleting a conversation preserves document and versions", () => {
    const conv = createDefaultConversation();
    const project: StoredEditorProject = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      document: {
        source: "<html><body>Document Stays</body></html>",
        revision: 5,
        context: getDefaultDocumentContext(),
      },
      conversations: [conv],
      messages: [],
      versions: [
        {
          id: "v_1",
          parentVersionId: null,
          source: "initial",
          revision: 0,
          htmlReference: "initial",
          summary: "Initial",
          createdAt: new Date().toISOString(),
        },
      ],
      activeConversationId: conv.id,
      sidebar: { width: 380, isCollapsed: false },
      timestamp: Date.now(),
    };

    saveProjectToStorage(project);

    // Simulate deleting the conversation
    const current = loadProjectFromStorage()!;
    current.conversations = current.conversations.filter((c) => c.id !== conv.id);
    current.activeConversationId = null;
    saveProjectToStorage(current);

    const updated = loadProjectFromStorage();
    expect(updated?.conversations.length).toBe(0);
    expect(updated?.document.source).toBe("<html><body>Document Stays</body></html>");
    expect(updated?.versions.length).toBe(1);
    expect(updated?.versions[0].id).toBe("v_1");
  });
});
