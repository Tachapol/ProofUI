import { describe, it, expect } from "vitest";
import { assignEditorIds, reassignSubtreeIds } from "../../src/lib/dom/serializer";
import { applyOperationToDocument } from "../../src/lib/editor/operations";

describe("Stable Node IDs", () => {
  it("preserves pre-existing IDs on elements", () => {
    const div = document.createElement("div");
    div.innerHTML = `
      <section data-editor-id="existing-section">
        <h1 data-editor-id="existing-title">Title</h1>
        <p>Unassigned Paragraph</p>
      </section>
    `;

    assignEditorIds(div);

    const sec = div.querySelector("section")!;
    const h1 = div.querySelector("h1")!;
    const p = div.querySelector("p")!;

    expect(sec.getAttribute("data-editor-id")).toBe("existing-section");
    expect(h1.getAttribute("data-editor-id")).toBe("existing-title");
    expect(p.getAttribute("data-editor-id")).toMatch(/^node_/);
  });

  it("assigns unique IDs to new nodes without deriving from index or DOM path", () => {
    const div = document.createElement("div");
    div.innerHTML = `
      <div><span>A</span></div>
      <div><span>B</span></div>
    `;

    assignEditorIds(div);

    const spans = div.querySelectorAll("span");
    const idA = spans[0].getAttribute("data-editor-id");
    const idB = spans[1].getAttribute("data-editor-id");

    expect(idA).toMatch(/^node_/);
    expect(idB).toMatch(/^node_/);
    expect(idA).not.toBe(idB);
  });

  it("moving siblings or editing does not change IDs of unaffected nodes", () => {
    const html = `
      <div data-editor-id="root">
        <p data-editor-id="p1">First</p>
        <p data-editor-id="p2">Second</p>
      </div>
    `;

    // Perform text edit on p1
    const res = applyOperationToDocument(html, {
      type: "update_text",
      nodeId: "p1",
      value: "First Updated",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = new DOMParser().parseFromString(res.source, "text/html");
      expect(doc.querySelector('[data-editor-id="p1"]')?.textContent).toBe("First Updated");
      // p2 retains its exact same ID
      expect(doc.querySelector('[data-editor-id="p2"]')?.textContent).toBe("Second");
    }
  });

  it("duplicated descendants receive fresh unique IDs", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-editor-id", "parent-1");
    parent.innerHTML = `
      <h2 data-editor-id="child-1">Heading</h2>
      <span data-editor-id="child-2">Badge</span>
    `;

    const clone = parent.cloneNode(true) as Element;
    reassignSubtreeIds(clone);

    const newParentId = clone.getAttribute("data-editor-id");
    const newChild1 = clone.querySelector("h2")!.getAttribute("data-editor-id");
    const newChild2 = clone.querySelector("span")!.getAttribute("data-editor-id");

    expect(newParentId).not.toBe("parent-1");
    expect(newChild1).not.toBe("child-1");
    expect(newChild2).not.toBe("child-2");

    expect(newParentId).toMatch(/^node_/);
    expect(newChild1).toMatch(/^node_/);
    expect(newChild2).toMatch(/^node_/);

    const idSet = new Set([newParentId, newChild1, newChild2]);
    expect(idSet.size).toBe(3);
  });
});
