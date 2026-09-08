"use client";

import { useState, useCallback, useMemo } from "react";
import { SerializedNode } from "@/lib/bridge/types";
import { UXAnalysisViewport } from "@/lib/optimization/schemas";
import {
  InteractionEvent,
  InteractionSessionSummary,
  ScrollDepth,
  MAX_EVENTS_PER_SESSION,
} from "./schemas";

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Collect all leaf element editor IDs from the document tree. */
function collectLeafEditorIds(node: SerializedNode | null): string[] {
  if (!node) return [];
  if (node.children.length === 0) {
    return node.id ? [node.id] : [];
  }
  const ids: string[] = [];
  for (const child of node.children) {
    ids.push(...collectLeafEditorIds(child));
  }
  return ids;
}

/** Create empty scroll depth state. */
function emptyScrollDepth(): ScrollDepth {
  return { reached25: false, reached50: false, reached75: false, reached100: false };
}

/** Create a blank session summary. */
function createBlankSummary(
  sessionId: string,
  viewport: UXAnalysisViewport
): InteractionSessionSummary {
  return {
    sessionId,
    startedAt: Date.now(),
    endedAt: null,
    viewport,
    totalEvents: 0,
    scrollDepth: emptyScrollDepth(),
    timeOnPageMs: 0,
    ctaClicks: {},
    elementClicks: {},
    mostClickedElements: [],
    elementsWithNoInteraction: [],
    formInteractions: {},
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export interface UseInteractionEvidenceReturn {
  /** Current interaction session summary, null if no session started. */
  summary: InteractionSessionSummary | null;
  /** Process an incoming InteractionEvent from the bridge. */
  processEvent: (event: InteractionEvent) => void;
  /** Reset the current session (e.g., when leaving preview mode). */
  resetSession: () => void;
  /** Start a new tracking session. */
  startSession: (sessionId: string, viewport: UXAnalysisViewport) => void;
  /** End the current tracking session (records endedAt). */
  endSession: () => void;
  /** Whether a tracking session is active. */
  isTracking: boolean;
  /** Most-clicked elements (top 10), computed from current state. */
  mostClickedElements: Array<{ editorId: string; tagName: string; count: number }>;
  /** Leaf elements with no interaction. */
  elementsWithNoInteraction: string[];
}

export function useInteractionEvidence(
  documentTree: SerializedNode | null,
): UseInteractionEvidenceReturn {
  const [summary, setSummary] = useState<InteractionSessionSummary | null>(null);
  // Tag name map stored as state to avoid ref access during render
  const [tagNameMap, setTagNameMap] = useState<Map<string, string>>(new Map());

  const startSession = useCallback(
    (sessionId: string, vp: UXAnalysisViewport) => {
      setTagNameMap(new Map());
      setSummary(createBlankSummary(sessionId, vp));
    },
    []
  );

  const endSession = useCallback(() => {
    setSummary((prev) => {
      if (!prev) return prev;
      return { ...prev, endedAt: Date.now(), timeOnPageMs: Date.now() - prev.startedAt };
    });
  }, []);

  const resetSession = useCallback(() => {
    setTagNameMap(new Map());
    setSummary(null);
  }, []);

  const processEvent = useCallback((event: InteractionEvent) => {
    // Update tag name map
    if (event.editorId && event.tagName) {
      setTagNameMap((prev) => {
        const next = new Map(prev);
        next.set(event.editorId, event.tagName);
        return next;
      });
    }

    setSummary((prev) => {
      if (!prev) return prev;
      if (prev.totalEvents >= MAX_EVENTS_PER_SESSION) return prev;

      const next = { ...prev };
      next.totalEvents = prev.totalEvents + 1;
      next.timeOnPageMs = Date.now() - prev.startedAt;

      switch (event.type) {
        case "click": {
          const clicks = { ...prev.elementClicks };
          clicks[event.editorId] = (clicks[event.editorId] || 0) + 1;
          next.elementClicks = clicks;
          break;
        }

        case "cta_click": {
          const ctaClicks = { ...prev.ctaClicks };
          ctaClicks[event.editorId] = (ctaClicks[event.editorId] || 0) + 1;
          next.ctaClicks = ctaClicks;
          // Also count in general clicks
          const allClicks = { ...prev.elementClicks };
          allClicks[event.editorId] = (allClicks[event.editorId] || 0) + 1;
          next.elementClicks = allClicks;
          break;
        }

        case "scroll_depth": {
          const percent = event.metadata?.scrollPercent;
          if (typeof percent === "number") {
            const sd = { ...prev.scrollDepth };
            if (percent >= 25) sd.reached25 = true;
            if (percent >= 50) sd.reached50 = true;
            if (percent >= 75) sd.reached75 = true;
            if (percent >= 100) sd.reached100 = true;
            next.scrollDepth = sd;
          }
          break;
        }

        case "form_focus": {
          const fi = { ...prev.formInteractions };
          const existing = fi[event.editorId] || { focusCount: 0, changeCount: 0 };
          fi[event.editorId] = {
            ...existing,
            focusCount: existing.focusCount + 1,
            fieldType: event.metadata?.formFieldType || existing.fieldType,
          };
          next.formInteractions = fi;
          break;
        }

        case "form_change": {
          const fic = { ...prev.formInteractions };
          const existingc = fic[event.editorId] || { focusCount: 0, changeCount: 0 };
          fic[event.editorId] = {
            ...existingc,
            changeCount: existingc.changeCount + 1,
            fieldType: event.metadata?.formFieldType || existingc.fieldType,
          };
          next.formInteractions = fic;
          break;
        }

        case "time_on_page":
          // Handled by timeOnPageMs calculation above
          break;
      }

      return next;
    });
  }, []);

  // Compute most-clicked elements (top 10)
  const mostClickedElements = useMemo(() => {
    if (!summary) return [];
    const entries = Object.entries(summary.elementClicks)
      .map(([editorId, count]) => ({
        editorId,
        tagName: tagNameMap.get(editorId) || "unknown",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return entries;
  }, [summary, tagNameMap]);

  // Compute leaf elements with no interaction
  const elementsWithNoInteraction = useMemo(() => {
    if (!summary || !documentTree) return [];
    const leafIds = collectLeafEditorIds(documentTree);
    const clickedSet = new Set(Object.keys(summary.elementClicks));
    return leafIds.filter((id) => !clickedSet.has(id));
  }, [summary, documentTree]);

  const isTracking = summary !== null && summary.endedAt === null;

  return {
    summary: summary
      ? { ...summary, mostClickedElements, elementsWithNoInteraction }
      : null,
    processEvent,
    resetSession,
    startSession,
    endSession,
    isTracking,
    mostClickedElements,
    elementsWithNoInteraction,
  };
}
