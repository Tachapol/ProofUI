import { describe, it, expect } from "vitest";
import { applyOperationToDocument } from "../../src/lib/editor/operations";

describe("Editor Operations Engine", () => {
  const sampleDoc = `
    <!DOCTYPE html>
    <html>
      <body data-editor-id="body-root">
        <section data-editor-id="hero-sec">
          <h1 data-editor-id="hero-title" class="text-4xl font-bold">Hello World</h1>
          <a data-editor-id="hero-link" href="https://example.com" class="text-blue-500">Learn More</a>
          <div data-editor-id="nested-container">
            <span data-editor-id="tag-badge">New</span>
            <p data-editor-id="desc">Some description</p>
          </div>
        </section>
      </body>
    </html>
  `;

  it("updates plain text on leaf element", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "update_text",
      nodeId: "hero-title",
      value: "Welcome to Next-Gen Visual Editor",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      expect(doc.querySelector('[data-editor-id="hero-title"]')?.textContent).toBe(
        "Welcome to Next-Gen Visual Editor"
      );
    }
  });

  it("rejects plain text replacement when element contains nested element children", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "update_text",
      nodeId: "nested-container",
      value: "Overwriting children",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("UNSAFE_NESTED_TEXT");
    }
  });

  it("adds and removes classes while deduplicating and trimming", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "update_classes",
      nodeId: "hero-title",
      add: ["text-6xl", "tracking-tight", "text-6xl"], // includes duplicate
      remove: ["text-4xl"],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      const title = doc.querySelector('[data-editor-id="hero-title"]')!;
      expect(title.className).toBe("font-bold text-6xl tracking-tight");
    }
  });

  it("sets safe attributes and auto-secures target=_blank", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "set_attribute",
      nodeId: "hero-link",
      name: "target",
      value: "_blank",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      const link = doc.querySelector('[data-editor-id="hero-link"]')!;
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("removes attributes cleanly", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "remove_attribute",
      nodeId: "hero-link",
      name: "href",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      const link = doc.querySelector('[data-editor-id="hero-link"]')!;
      expect(link.hasAttribute("href")).toBe(false);
    }
  });

  it("rejects unsafe event-handler attributes and javascript: URLs", () => {
    // Unsafe attribute name onclick
    const res1 = applyOperationToDocument(sampleDoc, {
      type: "set_attribute",
      nodeId: "hero-title",
      name: "onclick",
      value: "alert('pwned')",
    });
    expect(res1.ok).toBe(false);

    // Unsafe URL javascript:
    const res2 = applyOperationToDocument(sampleDoc, {
      type: "set_attribute",
      nodeId: "hero-link",
      name: "href",
      value: "javascript:evil()",
    });
    expect(res2.ok).toBe(false);
    if (!res2.ok) {
      expect(res2.code).toBe("UNSAFE_URL");
    }
  });

  it("duplicates a node subtree immediately after itself with fresh IDs", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "duplicate_node",
      nodeId: "nested-container",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newSelectedId).toBeDefined();
      expect(res.newSelectedId).toMatch(/^node_/);

      const doc = new DOMParser().parseFromString(res.source, "text/html");
      const original = doc.querySelector('[data-editor-id="nested-container"]')!;
      const duplicate = original.nextElementSibling!;

      expect(duplicate.getAttribute("data-editor-id")).toBe(res.newSelectedId);
      expect(duplicate.querySelector("p")?.textContent).toBe("Some description");
      expect(duplicate.querySelector("p")?.getAttribute("data-editor-id")).not.toBe("desc");
    }
  });

  it("deletes a node subtree cleanly", () => {
    const res = applyOperationToDocument(sampleDoc, {
      type: "delete_node",
      nodeId: "hero-title",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      expect(doc.querySelector('[data-editor-id="hero-title"]')).toBeNull();
    }
  });

  it("rejects deletion or duplication of protected nodes", () => {
    const resDel = applyOperationToDocument(sampleDoc, {
      type: "delete_node",
      nodeId: "body-root",
    });
    expect(resDel.ok).toBe(false);
    if (!resDel.ok) {
      expect(resDel.code).toBe("CANNOT_DELETE_PROTECTED");
    }

    const resDup = applyOperationToDocument(sampleDoc, {
      type: "duplicate_node",
      nodeId: "body-root",
    });
    expect(resDup.ok).toBe(false);
  });
});
