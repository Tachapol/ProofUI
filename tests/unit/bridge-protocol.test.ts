import { describe, it, expect } from "vitest";
import {
  parseIframeMessage,
  parseParentMessage,
  IframeToParentMessage,
  ParentToIframeMessage,
} from "../../src/lib/bridge/types";
import { getSampleTailwindDocument } from "../../src/lib/sample-document";
import { assignEditorIds, serializeDomTree } from "../../src/lib/dom/serializer";

describe("Bridge Protocol Zod Validation", () => {
  const testSessionId = "test-session-12345";

  it("validates legitimate IFRAME_READY message with sessionId", () => {
    const validMessage: IframeToParentMessage = {
      source: "visual-editor-iframe",
      type: "IFRAME_READY",
      payload: {
        sessionId: testSessionId,
        documentTree: {
          id: "node_0",
          tagName: "body",
          className: "bg-white",
          children: [
            {
              id: "node_1",
              tagName: "h1",
              className: "title",
              textContent: "Hello",
              children: [],
            },
          ],
        },
        title: "Test Page",
      },
    };

    const parsed = parseIframeMessage(validMessage, testSessionId);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("IFRAME_READY");
    if (parsed?.type === "IFRAME_READY") {
      expect(parsed.payload.documentTree.children[0].tagName).toBe("h1");
    }
  });

  it("rejects messages with mismatched session ID", () => {
    const validMessage: IframeToParentMessage = {
      source: "visual-editor-iframe",
      type: "NODE_HOVERED",
      payload: {
        sessionId: "forged-session-id",
        id: "node_1",
        rect: null,
        tagName: "div",
      },
    };

    // Expected session is testSessionId, but message has forged-session-id
    const parsed = parseIframeMessage(validMessage, testSessionId);
    expect(parsed).toBeNull();
  });

  it("validates NODE_SELECTED and RECTS_UPDATED messages", () => {
    const selectedMsg = {
      source: "visual-editor-iframe",
      type: "NODE_SELECTED",
      payload: {
        sessionId: testSessionId,
        id: "node_btn",
        rect: {
          top: 100,
          left: 50,
          width: 200,
          height: 40,
          bottom: 140,
          right: 250,
        },
        tagName: "button",
        path: ["node_0", "node_btn"],
      },
    };

    const parsed = parseIframeMessage(selectedMsg, testSessionId);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("NODE_SELECTED");

    const rectsMsg = {
      source: "visual-editor-iframe",
      type: "RECTS_UPDATED",
      payload: {
        sessionId: testSessionId,
        selectedId: "node_btn",
        selectedRect: {
          top: 120,
          left: 50,
          width: 200,
          height: 40,
          bottom: 160,
          right: 250,
        },
        hoveredId: null,
        hoveredRect: null,
      },
    };

    const parsedRects = parseIframeMessage(rectsMsg, testSessionId);
    expect(parsedRects).not.toBeNull();
    expect(parsedRects?.type).toBe("RECTS_UPDATED");
  });

  it("rejects invalid or forged iframe messages", () => {
    expect(parseIframeMessage({ source: "visual-editor-iframe", type: "INVALID_TYPE" })).toBeNull();
    expect(parseIframeMessage({ type: "NODE_HOVERED", payload: { id: "1" } })).toBeNull();
    expect(
      parseIframeMessage({
        source: "unknown-hacker",
        type: "NODE_SELECTED",
        payload: { sessionId: testSessionId, id: null, rect: null, tagName: null, path: [] },
      })
    ).toBeNull();
  });

  it("validates parent-to-iframe commands and APPLY_OPERATION", () => {
    const parentMsg: ParentToIframeMessage = {
      source: "visual-editor-parent",
      type: "SELECT_NODE",
      payload: {
        sessionId: testSessionId,
        id: "node_hero",
        scrollIntoView: true,
      },
    };

    const parsed = parseParentMessage(parentMsg, testSessionId);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("SELECT_NODE");
    if (parsed?.type === "SELECT_NODE") {
      expect(parsed.payload.id).toBe("node_hero");
      expect(parsed.payload.scrollIntoView).toBe(true);
    }

    const opMsg: ParentToIframeMessage = {
      source: "visual-editor-parent",
      type: "APPLY_OPERATION",
      payload: {
        sessionId: testSessionId,
        revision: 2,
        operation: {
          type: "update_classes",
          nodeId: "node_hero",
          add: ["text-6xl"],
          remove: ["text-4xl"],
        },
      },
    };

    const parsedOp = parseParentMessage(opMsg, testSessionId);
    expect(parsedOp).not.toBeNull();
    expect(parsedOp?.type).toBe("APPLY_OPERATION");
  });

  it("validates full sample document serialization and message", () => {
    const html = getSampleTailwindDocument("test-session-12345");
    const doc = new DOMParser().parseFromString(html, "text/html");
    assignEditorIds(doc.body);
    const tree = serializeDomTree(doc.body);
    const msg = {
      source: "visual-editor-iframe",
      type: "IFRAME_READY",
      payload: {
        sessionId: "test-session-12345",
        documentTree: tree,
        title: doc.title,
        revision: 0,
      },
    };
    const parsed = parseIframeMessage(msg, "test-session-12345");
    expect(parsed).not.toBeNull();
  });
});
