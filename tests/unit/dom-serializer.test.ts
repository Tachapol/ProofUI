import { describe, it, expect, beforeEach } from "vitest";
import {
  assignEditorIds,
  serializeDomTree,
  findNodeById,
  getNodePath,
} from "../../src/lib/dom/serializer";

describe("DOM Serializer and Editor ID Assignment", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("assigns stable opaque data-editor-id attributes", () => {
    document.body.innerHTML = `
      <div id="container">
        <header>
          <h1>Test Title</h1>
        </header>
        <main>
          <p>Paragraph 1</p>
          <p>Paragraph 2</p>
        </main>
      </div>
    `;

    const container = document.getElementById("container")!;
    assignEditorIds(container);

    const containerId = container.getAttribute("data-editor-id");
    expect(containerId).toMatch(/^node_/);

    const header = container.querySelector("header")!;
    const h1 = container.querySelector("h1")!;
    const main = container.querySelector("main")!;
    const p1 = container.querySelectorAll("p")[0]!;
    const p2 = container.querySelectorAll("p")[1]!;

    const ids = [
      containerId,
      header.getAttribute("data-editor-id"),
      h1.getAttribute("data-editor-id"),
      main.getAttribute("data-editor-id"),
      p1.getAttribute("data-editor-id"),
      p2.getAttribute("data-editor-id"),
    ];

    // Every node received an opaque node_ ID and all are unique
    for (const id of ids) {
      expect(id).toMatch(/^node_/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves pre-existing data-editor-id attributes", () => {
    document.body.innerHTML = `
      <div id="container">
        <button data-editor-id="custom-button-id">Click</button>
        <div><span>Child</span></div>
      </div>
    `;

    const container = document.getElementById("container")!;
    assignEditorIds(container);

    const button = container.querySelector("button")!;
    expect(button.getAttribute("data-editor-id")).toBe("custom-button-id");
  });

  it("serializes DOM tree accurately into JSON", () => {
    document.body.innerHTML = `
      <section class="hero bg-slate-900" id="hero-sec" data-editor-id="sec-1">
        <h1 class="text-4xl font-bold" data-editor-id="h1-1">Welcome to Visual Editor</h1>
        <button class="btn px-4 py-2" data-editor-id="btn-1">Get Started</button>
      </section>
    `;

    const section = document.querySelector("section")!;
    const serialized = serializeDomTree(section);

    expect(serialized.id).toBe("sec-1");
    expect(serialized.tagName).toBe("section");
    expect(serialized.className).toBe("hero bg-slate-900");
    expect(serialized.isComponentOrSection).toBe(true);
    expect(serialized.children).toHaveLength(2);

    const h1 = serialized.children[0];
    expect(h1.id).toBe("h1-1");
    expect(h1.tagName).toBe("h1");
    expect(h1.textContent).toBe("Welcome to Visual Editor");

    const btn = serialized.children[1];
    expect(btn.id).toBe("btn-1");
    expect(btn.tagName).toBe("button");
    expect(btn.textContent).toBe("Get Started");
  });

  it("finds nodes and builds breadcrumb paths correctly", () => {
    document.body.innerHTML = `
      <div data-editor-id="root">
        <main data-editor-id="main">
          <section data-editor-id="sec">
            <h2 data-editor-id="title">Subheading</h2>
          </section>
        </main>
      </div>
    `;

    const root = document.querySelector("div")!;
    const tree = serializeDomTree(root);

    const found = findNodeById(tree, "title");
    expect(found).not.toBeNull();
    expect(found?.tagName).toBe("h2");
    expect(found?.textContent).toBe("Subheading");

    const path = getNodePath(tree, "title");
    expect(path.map((n) => n.tagName)).toEqual(["div", "main", "section", "h2"]);
  });
});
