import { EDITOR_CONFIG } from "./constants";

export interface HistoryEntry {
  source: string;
  selectedNodeId: string | null;
  description: string;
  timestamp: number;
  isBurstText?: boolean;
}

export class HistoryManager {
  private past: HistoryEntry[] = [];
  private present: HistoryEntry;
  private future: HistoryEntry[] = [];
  private maxEntries: number;

  constructor(
    initialSource: string,
    initialSelectedId: string | null = null,
    maxEntries: number = EDITOR_CONFIG.MAX_HISTORY_ENTRIES
  ) {
    this.present = {
      source: initialSource,
      selectedNodeId: initialSelectedId,
      description: "Initial Document",
      timestamp: Date.now(),
    };
    this.maxEntries = maxEntries;
  }

  public getCurrent(): HistoryEntry {
    return this.present;
  }

  public getCanUndo(): boolean {
    return this.past.length > 0;
  }

  public getCanRedo(): boolean {
    return this.future.length > 0;
  }

  public getPastCount(): number {
    return this.past.length;
  }

  public getFutureCount(): number {
    return this.future.length;
  }

  /**
   * Pushes a new state to the history.
   * If isBurstText is true and occurred within the burst window, updates the top entry.
   * Clears the redo stack on any new mutation.
   */
  public push(
    source: string,
    selectedNodeId: string | null,
    description: string,
    isBurstText = false
  ): void {
    const now = Date.now();

    // Check if continuous typing burst should be merged
    if (
      isBurstText &&
      this.present.isBurstText &&
      now - this.present.timestamp < EDITOR_CONFIG.TEXT_DEBOUNCE_MS + 200
    ) {
      this.present.source = source;
      this.present.selectedNodeId = selectedNodeId;
      this.present.timestamp = now;
      return;
    }

    this.past.push({ ...this.present });
    if (this.past.length > this.maxEntries) {
      this.past.shift();
    }

    this.present = {
      source,
      selectedNodeId,
      description,
      timestamp: now,
      isBurstText,
    };

    // Any new action clears the redo future
    this.future = [];
  }

  /**
   * Reverts to the previous document state.
   */
  public undo(): HistoryEntry | null {
    if (this.past.length === 0) {
      return null;
    }

    const previous = this.past.pop()!;
    this.future.unshift({ ...this.present });
    this.present = previous;
    return this.present;
  }

  /**
   * Re-applies an undone state.
   */
  public redo(): HistoryEntry | null {
    if (this.future.length === 0) {
      return null;
    }

    const next = this.future.shift()!;
    this.past.push({ ...this.present });
    this.present = next;
    return this.present;
  }

  /**
   * Clears past and future, resetting to a fresh baseline.
   */
  public reset(source: string, selectedNodeId: string | null = null): void {
    this.past = [];
    this.future = [];
    this.present = {
      source,
      selectedNodeId,
      description: "Reset Document",
      timestamp: Date.now(),
    };
  }
}
