import { describe, it, expect } from "vitest";
import { reconcileEditorIds } from "../../src/lib/code/id-reconciliation";

describe("Stable ID Reconciliation Engine", () => {
  const originalHtml = `
    <!DOCTYPE html>
    <html>
      <body data-editor-id="node_body">
        <header data-editor-id="node_header">
          <h1 id="page-title" data-editor-id="node_title">Landing Page</h1>
          <a href="/pricing" data-editor-id="node_link">Pricing</a>
        </header>
        <main data-editor-id="node_main">
          <p data-editor-id="node_p1">First paragraph</p>
          <p data-editor-id="node_p2">Second paragraph</p>
        </main>
      </body>
    </html>
  `;

  it("preserves exact node IDs when HTML is simply reformatted or indented", () => {
    // Reformat spacing and linebreaks
    const reformattedHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <header data-editor-id="node_header">
            <h1 id="page-title" data-editor-id="node_title">
              Landing Page
            </h1>
            <a href="/pricing" data-editor-id="node_link">Pricing</a>
          </header>
          <main data-editor-id="node_main">
            <p data-editor-id="node_p1">First paragraph</p>
            <p data-editor-id="node_p2">Second paragraph</p>
          </main>
        </body>
      </html>
    `;

    const res = reconcileEditorIds(originalHtml, reformattedHtml);
    expect(res.preservedCount).toBeGreaterThanOrEqual(6);
    expect(res.assignedCount).toBe(0);
    expect(res.regeneratedCount).toBe(0);

    const doc = new DOMParser().parseFromString(res.reconciledHtml, "text/html");
    expect(doc.querySelector("#page-title")?.getAttribute("data-editor-id")).toBe("node_title");
    expect(doc.querySelector('a[href="/pricing"]')?.getAttribute("data-editor-id")).toBe("node_link");
  });

  it("reconciles and recovers IDs when the user accidentally removes data-editor-id attributes", () => {
    // User accidentally stripped data-editor-id from h1 and p1
    const strippedHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <header data-editor-id="node_header">
            <h1 id="page-title">Landing Page</h1>
            <a href="/pricing" data-editor-id="node_link">Pricing</a>
          </header>
          <main data-editor-id="node_main">
            <p>First paragraph</p>
            <p data-editor-id="node_p2">Second paragraph</p>
          </main>
        </body>
      </html>
    `;

    const res = reconcileEditorIds(originalHtml, strippedHtml);
    const doc = new DOMParser().parseFromString(res.reconciledHtml, "text/html");

    // Recovered via id="page-title"
    expect(doc.querySelector("#page-title")?.getAttribute("data-editor-id")).toBe("node_title");
    // Recovered via unique text and ancestry
    expect(doc.querySelectorAll("p")[0].getAttribute("data-editor-id")).toBe("node_p1");
  });

  it("assigns fresh opaque IDs to genuinely new elements", () => {
    const htmlWithNewEl = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <main data-editor-id="node_main">
            <p data-editor-id="node_p1">First paragraph</p>
            <button class="btn">Brand New CTA</button>
          </main>
        </body>
      </html>
    `;

    const res = reconcileEditorIds(originalHtml, htmlWithNewEl);
    const doc = new DOMParser().parseFromString(res.reconciledHtml, "text/html");
    const btn = doc.querySelector("button")!;

    expect(btn.getAttribute("data-editor-id")).toMatch(/^node_/);
    expect(btn.getAttribute("data-editor-id")).not.toBe("node_p1");
  });

  it("safely resolves and reassigns duplicate editor IDs", () => {
    const duplicateIdHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <div data-editor-id="node_dup">Box A</div>
          <div data-editor-id="node_dup">Box B (pasted clone)</div>
        </body>
      </html>
    `;

    const res = reconcileEditorIds(originalHtml, duplicateIdHtml);
    const doc = new DOMParser().parseFromString(res.reconciledHtml, "text/html");
    const ids = Array.from(doc.querySelectorAll("[data-editor-id]")).map((el) =>
      el.getAttribute("data-editor-id")
    );

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(res.regeneratedCount).toBe(1);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("does not force ambiguous matches for repeated identical cards or links and assigns fresh IDs", () => {
    const cardListOldHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <div class="cards" data-editor-id="node_cards">
            <div class="card" data-editor-id="card_1"><a href="#">Learn more</a></div>
            <div class="card" data-editor-id="card_2"><a href="#">Learn more</a></div>
            <div class="card" data-editor-id="card_3"><a href="#">Learn more</a></div>
          </div>
        </body>
      </html>
    `;

    // New version stripped editor IDs from cards
    const cardListNewHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <div class="cards" data-editor-id="node_cards">
            <div class="card"><a href="#">Learn more</a></div>
            <div class="card"><a href="#">Learn more</a></div>
            <div class="card"><a href="#">Learn more</a></div>
          </div>
        </body>
      </html>
    `;

    const res = reconcileEditorIds(cardListOldHtml, cardListNewHtml, { confidenceThreshold: 0.70 });
    const doc = new DOMParser().parseFromString(res.reconciledHtml, "text/html");
    const newCards = doc.querySelectorAll(".card");
    const newCardIds = Array.from(newCards).map((c) => c.getAttribute("data-editor-id")!);

    // Since the cards have identical repeated structure and text, the engine refuses ambiguous matches
    // and safely generates fresh IDs rather than guessing wrongly
    expect(newCardIds).toHaveLength(3);
    const uniqueIds = new Set(newCardIds);
    expect(uniqueIds.size).toBe(3);
    for (const id of newCardIds) {
      expect(id).toMatch(/^node_/);
    }
  });

  it("respects custom confidence threshold to tune strictness", () => {
    const oldHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <main data-editor-id="node_main">
            <p data-editor-id="p_unique">A very specific and unique sentence.</p>
          </main>
        </body>
      </html>
    `;
    const newHtml = `
      <!DOCTYPE html>
      <html>
        <body data-editor-id="node_body">
          <main data-editor-id="node_main">
            <p>A very specific and unique sentence.</p>
          </main>
        </body>
      </html>
    `;

    // High threshold (0.90) requires HTML #id or href, so unique text (0.78) will be assigned a fresh ID
    const strictRes = reconcileEditorIds(oldHtml, newHtml, { confidenceThreshold: 0.90 });
    const strictDoc = new DOMParser().parseFromString(strictRes.reconciledHtml, "text/html");
    expect(strictDoc.querySelector("p")?.getAttribute("data-editor-id")).toMatch(/^node_/);

    // Standard threshold (0.70) accepts unique text match (0.78)
    const standardRes = reconcileEditorIds(oldHtml, newHtml, { confidenceThreshold: 0.70 });
    const standardDoc = new DOMParser().parseFromString(standardRes.reconciledHtml, "text/html");
    expect(standardDoc.querySelector("p")?.getAttribute("data-editor-id")).toBe("p_unique");
  });
});
