import { describe, it, expect } from "vitest";
import { HistoryManager } from "../../src/lib/editor/history";

describe("Document History (Undo / Redo)", () => {
  it("pushes states and performs undo and redo correctly", () => {
    const history = new HistoryManager("Initial HTML", "node-1");

    expect(history.getCanUndo()).toBe(false);
    expect(history.getCanRedo()).toBe(false);

    // Edit 1: change text
    history.push("State 2 HTML", "node-1", "Change text");
    expect(history.getCanUndo()).toBe(true);
    expect(history.getCanRedo()).toBe(false);
    expect(history.getCurrent().source).toBe("State 2 HTML");

    // Edit 2: change class
    history.push("State 3 HTML", "node-2", "Change class");
    expect(history.getCurrent().source).toBe("State 3 HTML");

    // Undo to State 2
    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone?.source).toBe("State 2 HTML");
    expect(undone?.selectedNodeId).toBe("node-1");
    expect(history.getCanUndo()).toBe(true);
    expect(history.getCanRedo()).toBe(true);

    // Undo to Initial
    const undoneInitial = history.undo();
    expect(undoneInitial?.source).toBe("Initial HTML");
    expect(history.getCanUndo()).toBe(false);

    // Redo to State 2
    const redone = history.redo();
    expect(redone?.source).toBe("State 2 HTML");
    expect(history.getCanUndo()).toBe(true);

    // Redo to State 3
    const redone3 = history.redo();
    expect(redone3?.source).toBe("State 3 HTML");
    expect(history.getCanRedo()).toBe(false);
  });

  it("clears redo future when a new edit is performed after undo", () => {
    const history = new HistoryManager("State 1");
    history.push("State 2", null, "Edit 2");
    history.push("State 3", null, "Edit 3");

    // Undo to State 2
    history.undo();
    expect(history.getCanRedo()).toBe(true);

    // Push new State 4
    history.push("State 4", null, "Branch edit 4");
    // Redo future must be cleared
    expect(history.getCanRedo()).toBe(false);
    expect(history.getCurrent().source).toBe("State 4");

    // Undo brings us back to State 2
    expect(history.undo()?.source).toBe("State 2");
  });

  it("groups typing bursts within the debounce window into a single history entry", () => {
    const history = new HistoryManager("Text: H");

    // Continuous typing
    history.push("Text: He", "node-input", "Type 'e'", true);
    history.push("Text: Hel", "node-input", "Type 'l'", true);
    history.push("Text: Hello", "node-input", "Type 'lo'", true);

    // Because all were burst text within ms window, past stack should only have the initial entry!
    expect(history.getPastCount()).toBe(1);
    expect(history.getCurrent().source).toBe("Text: Hello");

    // Undo returns straight to initial
    const undone = history.undo();
    expect(undone?.source).toBe("Text: H");
  });

  it("enforces maximum history limit", () => {
    const limit = 5;
    const history = new HistoryManager("Init", null, limit);

    for (let i = 1; i <= 10; i++) {
      history.push(`State ${i}`, null, `Edit ${i}`);
    }

    expect(history.getPastCount()).toBe(limit);
  });
});
