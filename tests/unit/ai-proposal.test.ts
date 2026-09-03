import { describe, it, expect } from "vitest";
import { AIEditProposalSchema, AIEditProposal } from "../../src/lib/ai/schemas";
import { validateProposalScope } from "../../src/lib/ai/scope-validation";
import { simulateProposal } from "../../src/lib/ai/proposal-simulator";
import { MockAIEditProvider } from "../../src/lib/ai/mock-provider";
import { SerializedNode } from "../../src/lib/bridge/types";
import { HistoryManager } from "../../src/lib/editor/history";

describe("AI Proposals, Scope Enforcement, and Simulation", () => {
  const sampleDoc = `
    <!DOCTYPE html>
    <html>
      <body data-editor-id="body-root">
        <section data-editor-id="sec-hero">
          <h1 data-editor-id="hero-title" class="text-4xl font-bold">Hello World</h1>
          <button data-editor-id="hero-btn" class="bg-indigo-600">Get Started</button>
        </section>
        <section data-editor-id="sec-footer">
          <p data-editor-id="footer-p">Copyright 2026</p>
        </section>
      </body>
    </html>
  `;

  const documentTree: SerializedNode = {
    id: "body-root",
    tagName: "body",
    className: "",
    children: [
      {
        id: "sec-hero",
        tagName: "section",
        className: "",
        children: [
          { id: "hero-title", tagName: "h1", className: "text-4xl font-bold", children: [] },
          { id: "hero-btn", tagName: "button", className: "bg-indigo-600", children: [] },
        ],
      },
      {
        id: "sec-footer",
        tagName: "section",
        className: "",
        children: [{ id: "footer-p", tagName: "p", className: "", children: [] }],
      },
    ],
  };

  it("validates deterministic mock proposal generation for headline larger", async () => {
    const provider = new MockAIEditProvider();
    const proposal = await provider.generateEdit({
      instruction: "Make the hero headline larger",
      scope: "selected_node",
      selectedNodeId: "hero-title",
      documentRevision: 2,
      context: {
        selectedNode: { id: "hero-title", tagName: "h1", className: "text-4xl font-bold", children: [] },
      },
    });

    const parsed = AIEditProposalSchema.safeParse(proposal);
    expect(parsed.success).toBe(true);
    expect(proposal.operations[0].type).toBe("update_classes");
    if (proposal.operations[0].type === "update_classes") {
      expect(proposal.operations[0].add).toContain("text-6xl");
      expect(proposal.operations[0].remove).toContain("text-4xl");
    }
  });

  it("enforces scope and rejects operations targeting nodes outside selected scope", () => {
    const outOfScopeProposal: AIEditProposal = {
      proposalId: "prop-1",
      basedOnRevision: 1,
      summary: "Bad edit",
      operations: [
        {
          type: "update_text",
          nodeId: "footer-p", // Outside selected_node hero-title!
          value: "Malicious modification",
        },
      ],
      warnings: [],
    };

    const scopeCheck = validateProposalScope({
      proposal: outOfScopeProposal,
      scope: "selected_node",
      instruction: "Update title",
      selectedNodeId: "hero-title",
      documentTree,
    });

    expect(scopeCheck.isValid).toBe(false);
    expect(scopeCheck.errors[0]).toContain("escapes the requested scope");
  });

  it("requires explicit user permission for delete and duplicate operations", () => {
    // Instruction does NOT mention delete
    const unpermittedDeleteProposal: AIEditProposal = {
      proposalId: "prop-del",
      basedOnRevision: 1,
      summary: "Delete node without permission",
      operations: [{ type: "delete_node", nodeId: "hero-title" }],
      warnings: [],
    };

    const check1 = validateProposalScope({
      proposal: unpermittedDeleteProposal,
      scope: "document",
      instruction: "Simplify this section", // Vague!
      selectedNodeId: null,
      documentTree,
    });
    expect(check1.isValid).toBe(false);
    expect(check1.errors[0]).toContain("does not explicitly authorize deletion");

    // Instruction DOES mention delete
    const check2 = validateProposalScope({
      proposal: unpermittedDeleteProposal,
      scope: "document",
      instruction: "Please delete the hero headline",
      selectedNodeId: null,
      documentTree,
    });
    expect(check2.isValid).toBe(true);
  });

  it("rejects simulation on stale document revisions", () => {
    const proposal: AIEditProposal = {
      proposalId: "prop-stale",
      basedOnRevision: 1, // Stale! Current is 3
      summary: "Stale edit",
      operations: [{ type: "update_text", nodeId: "hero-title", value: "New Title" }],
      warnings: [],
    };

    const sim = simulateProposal(proposal, sampleDoc, 3);
    expect(sim.canApply).toBe(false);
    expect(sim.errors[0]).toContain("Proposal is based on revision 1, but the document is currently on revision 3");
  });

  it("simulates multi-operation proposals atomically without mutating canonical source", () => {
    const multiOpProposal: AIEditProposal = {
      proposalId: "prop-multi",
      basedOnRevision: 1,
      summary: "Multi-edit",
      operations: [
        { type: "update_text", nodeId: "hero-title", value: "Updated Title" },
        { type: "update_classes", nodeId: "hero-btn", add: ["px-8"], remove: [] },
      ],
      warnings: [],
    };

    const sim = simulateProposal(multiOpProposal, sampleDoc, 1);
    expect(sim.canApply).toBe(true);
    expect(sim.predictedSource).toContain("Updated Title");
    expect(sim.predictedSource).toContain("px-8");

    // sampleDoc is pristine and unchanged
    expect(sampleDoc).toContain("Hello World");
  });

  it("fails completely if any operation fails (atomic simulation)", () => {
    const failingProposal: AIEditProposal = {
      proposalId: "prop-fail",
      basedOnRevision: 1,
      summary: "Partially invalid",
      operations: [
        { type: "update_text", nodeId: "hero-title", value: "Valid Part" },
        { type: "update_text", nodeId: "nonexistent-node-123", value: "Invalid Part" },
      ],
      warnings: [],
    };

    const sim = simulateProposal(failingProposal, sampleDoc, 1);
    expect(sim.canApply).toBe(false);
    expect(sim.errors.length).toBeGreaterThan(0);
  });

  it("applies accepted proposal as a single history entry that reverts atomically on undo", () => {
    const history = new HistoryManager(sampleDoc, "hero-title");

    const multiOpProposal: AIEditProposal = {
      proposalId: "prop-hist",
      basedOnRevision: 1,
      summary: "Transform hero",
      operations: [
        { type: "update_text", nodeId: "hero-title", value: "Modern SaaS" },
        { type: "update_classes", nodeId: "hero-title", add: ["text-7xl"], remove: ["text-4xl"] },
      ],
      warnings: [],
    };

    const sim = simulateProposal(multiOpProposal, sampleDoc, 1);
    expect(sim.canApply).toBe(true);

    // Apply simulation as one single history push
    history.push(sim.predictedSource, "hero-title", `AI Edit: ${multiOpProposal.summary}`);

    expect(history.getCanUndo()).toBe(true);
    expect(history.getCurrent().source).toContain("Modern SaaS");
    expect(history.getCurrent().source).toContain("text-7xl");

    // Single Undo reverts ALL operations from proposal!
    const undone = history.undo();
    expect(undone?.source).toBe(sampleDoc);
    expect(undone?.source).toContain("Hello World");
    expect(undone?.source).toContain("text-4xl");
    expect(history.getCanUndo()).toBe(false);
  });
});
