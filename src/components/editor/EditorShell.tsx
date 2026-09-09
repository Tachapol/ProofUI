"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Toolbar, SaveStatus, EditorMode, ThemeMode } from "./Toolbar";
import { LayersPanel } from "./LayersPanel";
import { ViewportCanvas } from "./ViewportCanvas";
import { PropertiesPanel } from "./PropertiesPanel";
import { OptimizationPanel } from "./OptimizationPanel";
import { CodeEditorPanel } from "./CodeEditorPanel";
import { ChatSidebar } from "../chat/ChatSidebar";
import { GenerationPreviewBanner } from "../chat/GenerationPreviewBanner";
import { VersionHistoryDialog } from "../chat/VersionHistoryDialog";
import { AIProposalReview } from "./AIProposalReview";
import { Sparkles, ChevronRight, Sliders } from "lucide-react";
import { UXAnalysisResult, OptimizationComparison } from "@/lib/optimization/schemas";
import {
  SerializedNode,
  DOMRectData,
  parseIframeMessage,
  ParentToIframeMessage,
} from "@/lib/bridge/types";
import { getNodePath, findNodeById } from "@/lib/dom/serializer";
import { ViewportMode, EDITOR_CONFIG } from "@/lib/editor/constants";
import { useFrameDimensions } from "@/lib/editor/useFrameDimensions";
import { EditorOperation } from "@/lib/editor/operation-schema";
import { applyOperationToDocument } from "@/lib/editor/operations";
import { HistoryManager } from "@/lib/editor/history";
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  clearDocumentFromStorage,
  EditorDocumentContext,
  getDefaultDocumentContext,
  CURRENT_SCHEMA_VERSION,
} from "@/lib/editor/persistence";
import { getSampleTailwindDocument } from "@/lib/sample-document";
import { reconcileEditorIds } from "@/lib/code/id-reconciliation";
import { AIEditProposal, AIEditScope } from "@/lib/ai/schemas";
import { buildSafeAIContext } from "@/lib/ai/context-builder";
import { validateProposalScope } from "@/lib/ai/scope-validation";
import { simulateProposal } from "@/lib/ai/proposal-simulator";
import { useResizablePanel } from "@/lib/chat/useResizablePanel";
import { useChatWorkspace } from "@/lib/chat/useChatWorkspace";
import { useDocumentVersions } from "@/lib/generation/useDocumentVersions";
import {
  GenerationCandidate,
  PageGenerationResult,
} from "@/lib/generation/schemas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImportWebsiteDialog } from "@/components/import/ImportWebsiteDialog";
import { PublishDialog } from "./PublishDialog";
import { CreateExperimentDialog } from "./CreateExperimentDialog";
import { useInteractionEvidence } from "@/lib/interaction/useInteractionEvidence";
import { ProjectOverview } from "./ProjectOverview";
import { ReviewState } from "@/lib/review/workflow";

export function EditorShell() {
  // Stable editor session ID in parent
  const [sessionId] = useState("proof-editor-session");

  const [editorMode, setEditorMode] = useState<EditorMode>("design");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const {
    frameWidth,
    frameHeight,
    setWidth: setFrameWidth,
    setHeight: setFrameHeight,
    adjustWidth,
    adjustHeight,
    resetFrameSize,
    startResize: startFrameResize,
    isResizing: isResizingFrame,
  } = useFrameDimensions(viewport);
  const [documentTree, setDocumentTree] = useState<SerializedNode | null>(null);
  const [rightSidebarTab, setRightSidebarTab] = useState<"properties" | "optimization">("properties");

  // Interaction evidence tracking for preview mode
  const interactionEvidence = useInteractionEvidence(documentTree);

  // Theme state: default to dark mode with local persistence
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("proofui_theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("proofui_theme", theme);
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Canonical document state
  const initialProject = useMemo(() => {
    if (typeof window !== "undefined") {
      return loadProjectFromStorage();
    }
    return null;
  }, []);
  const [uxAnalysis, setUxAnalysis] = useState<UXAnalysisResult | null>(initialProject?.review?.analysis ?? null);
  const [decisions, setDecisions] = useState<ReviewState["decisions"]>(initialProject?.review?.decisions ?? []);
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>(initialProject?.review?.selectedFindingIds ?? []);
  const [reviewRefresh, setReviewRefresh] = useState(0);

  const [canonicalSource, setCanonicalSource] = useState<string>(() => {
    return initialProject?.document.source || getSampleTailwindDocument(sessionId);
  });
  const [revision, setRevision] = useState<number>(() => {
    return initialProject?.document.revision || 1;
  });
  const [documentContext, setDocumentContext] = useState<EditorDocumentContext>(() => {
    return initialProject?.document.context || getDefaultDocumentContext();
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  // Selection state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRect, setSelectedRect] = useState<DOMRectData | null>(null);
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);

  // Hover state
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRectData | null>(null);
  const [hoveredTagName, setHoveredTagName] = useState<string | null>(null);

  // Undo / Redo History
  const [historyManager] = useState(() => new HistoryManager(canonicalSource, null));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Document Version History
  const { versions, addVersion, restoreVersion } = useDocumentVersions(
    initialProject?.versions || [
      {
        id: "ver_initial",
        parentVersionId: null,
        source: "initial",
        revision: 1,
        htmlReference: canonicalSource,
        summary: "Initial Document Template",
        createdAt: new Date().toISOString(),
      },
    ]
  );
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);

  // Code Mode Unapplied Changes Warning state
  const [hasUnappliedCodeChanges, setHasUnappliedCodeChanges] = useState(false);
  const [showLeaveCodeWarning, setShowLeaveCodeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);

  // AI Proposal Review state
  const [activeProposal, setActiveProposal] = useState<AIEditProposal | null>(null);
  const [proposalScope, setProposalScope] = useState<AIEditScope>("document");

  // Website Import State
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Publish & Deploy Dialog State
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [projectId] = useState("proj_default");
  const [pageId] = useState("page_landing");

  // Experiment Dialog State
  const [showCreateExperimentDialog, setShowCreateExperimentDialog] = useState(false);
  const [expControlVersionId, setExpControlVersionId] = useState<string | undefined>(undefined);
  const [expVariantVersionId, setExpVariantVersionId] = useState<string | undefined>(undefined);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [optimizationEvidenceMode, setOptimizationEvidenceMode] = useState<"preview" | "production" | "experiment">("preview");

  const handleOpenCreateExperiment = (controlId: string, variantId: string) => {
    setExpControlVersionId(controlId);
    setExpVariantVersionId(variantId);
    setShowCreateExperimentDialog(true);
  };

  // Generation Candidate Preview state
  const [candidate, setCandidate] = useState<GenerationCandidate | null>(() => initialProject?.review?.candidates.find(c => c.result.id === initialProject.review?.activeCandidateId && c.status === "ready") ?? null);
  const [candidatesMap, setCandidatesMap] = useState<Map<string, GenerationCandidate>>(() => new Map(initialProject?.review?.candidates.map(c => [c.result.id, c]) ?? []));
  const [isComparingOriginal, setIsComparingOriginal] = useState(false);

  // Chat Sidebar Resizable Panel Hook
  const {
    width: sidebarWidth,
    isCollapsed: isSidebarCollapsed,
    toggleCollapse: toggleSidebarCollapse,
    handleMouseDown: handleSidebarMouseDown,
    handleKeyDown: handleSidebarKeyDown,
  } = useResizablePanel({
    storageKey: "proof_ui_chat_sidebar_width",
    defaultWidth: initialProject?.sidebar?.width || 380,
    defaultCollapsed: initialProject?.sidebar?.isCollapsed ?? true,
    side: "left",
  });

  // Layers Panel Resizable Hook
  const {
    width: layersWidth,
    isCollapsed: isLayersCollapsed,
    toggleCollapse: toggleLayersCollapse,
    handleMouseDown: handleLayersMouseDown,
    handleKeyDown: handleLayersKeyDown,
  } = useResizablePanel({
    storageKey: "proof_ui_layers_panel_width",
    defaultWidth: 260,
    minWidth: 200,
    maxWidth: 480,
    defaultCollapsed: false,
    side: "left",
  });

  // Right Sidebar (Properties / UX Analyzer) Resizable Hook
  const {
    width: rightSidebarWidth,
    isCollapsed: isRightSidebarCollapsed,
    toggleCollapse: toggleRightSidebarCollapse,
    handleMouseDown: handleRightSidebarMouseDown,
    handleKeyDown: handleRightSidebarKeyDown,
  } = useResizablePanel({
    storageKey: "proof_ui_right_sidebar_width",
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 640,
    defaultCollapsed: false,
    side: "right",
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // PostMessage sender with strict session envelope
  const sendToIframe = useCallback(
    (message: ParentToIframeMessage) => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(message, "*");
      }
    },
    []
  );

  // Update undo/redo availability
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyManager.getCanUndo());
    setCanRedo(historyManager.getCanRedo());
  }, [historyManager]);

  // AI Edit Submission Handler (called from Chat Workspace)
  const handlePerformAIEdit = useCallback(
    async ({
      instruction,
      scope,
      signal,
    }: {
      instruction: string;
      scope: AIEditScope;
      signal?: AbortSignal;
    }): Promise<AIEditProposal> => {
      setProposalScope(scope);
      const selectionPath = documentTree && selectedId ? getNodePath(documentTree, selectedId) : [];
      const selected = documentTree && selectedId ? findNodeById(documentTree, selectedId) : null;

      const context = buildSafeAIContext({
        scope,
        selectedNode: selected,
        breadcrumbNodes: selectionPath,
        canonicalSource,
      });

      const response = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          scope,
          selectedNodeId: selectedId,
          documentRevision: revision,
          context,
        }),
        signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      const proposal = data.proposal as AIEditProposal;

      const scopeValidation = validateProposalScope({
        proposal,
        scope,
        instruction,
        selectedNodeId: selectedId,
        documentTree,
      });

      if (!scopeValidation.isValid) {
        throw new Error(`Scope policy violation: ${scopeValidation.errors.join("; ")}`);
      }

      setActiveProposal(proposal);
      return proposal;
    },
    [documentTree, selectedId, canonicalSource, revision]
  );

  // Candidate generation ready handler
  const handleGenerationResultReady = useCallback((result: PageGenerationResult) => {
    const comparison =
      result.optimizationComparison ||
      (result as { comparison?: OptimizationComparison }).comparison;
    const newCandidate: GenerationCandidate = {
      result,
      sanitizedHtml: result.html,
      status: "ready",
      usage: result.usage,
      durationMs: result.durationMs,
      optimizationComparison: comparison,
    };
    setCandidate(newCandidate);
    setCandidatesMap((prev) => new Map(prev).set(result.id, newCandidate));
    setDecisions(prev => [...prev, { candidateId: result.id, baselineVersionId: versions.at(-1)?.id ?? "unversioned", analysis: null, selectedFindingIds: [], appliedVersionId: null }]);
  }, [versions]);

  // Optimization candidate ready handler (immediately activates preview banner)
  const handleOptimizationCandidateReady = useCallback(
    (result: PageGenerationResult, selectedFindingIds: string[] = []) => {
      const comparison =
        result.optimizationComparison ||
        (result as { comparison?: OptimizationComparison }).comparison;
      const newCandidate: GenerationCandidate = {
        result,
        sanitizedHtml: result.html,
        status: "ready",
        usage: result.usage,
        durationMs: result.durationMs,
        optimizationComparison: comparison,
      };
      setCandidate(newCandidate);
      setCandidatesMap((prev) => new Map(prev).set(result.id, newCandidate));
      setDecisions(prev => [...prev, { candidateId: result.id, baselineVersionId: versions.at(-1)?.id ?? "unversioned", analysis: uxAnalysis, selectedFindingIds, appliedVersionId: null }]);
      setIsComparingOriginal(false);
      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: newCandidate.sanitizedHtml,
          revision,
        },
      });
    },
    [sessionId, revision, sendToIframe, versions, uxAnalysis]
  );

  // Chat Workspace Hook
  const {
    conversations,
    activeConversation,
    messages,
    isProcessing,
    currentStage,
    handleNewConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleSelectConversation,
    addTimelineEvent,
    submitEdit,
    submitGenerate,
    handleCancel: handleCancelAI,
  } = useChatWorkspace({
    initialConversations: initialProject?.conversations,
    initialMessages: initialProject?.messages,
    initialActiveId: initialProject?.activeConversationId,
    onPerformEdit: handlePerformAIEdit,
    onGenerationResultReady: handleGenerationResultReady,
    documentRevision: revision,
  });

  // Persist project changes
  const persistProject = useCallback(
    (customSource?: string, customRev?: number, customContext?: EditorDocumentContext) => {
      if (typeof window === "undefined") return;
      const saved = saveProjectToStorage({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        document: {
          source: customSource ?? canonicalSource,
          revision: customRev ?? revision,
          context: customContext ?? documentContext,
        },
        conversations,
        messages,
        versions,
        activeConversationId: activeConversation?.id ?? null,
        review: {
          analysis: uxAnalysis,
          decisions,
          candidates: Array.from(candidatesMap.values()),
          activeCandidateId: candidate?.result.id ?? null,
          selectedFindingIds,
        },
        sidebar: {
          width: sidebarWidth,
          isCollapsed: isSidebarCollapsed,
        },
        timestamp: Date.now(),
      });
      setSaveStatus(saved ? "saved" : "unsaved");
    },
    [
      canonicalSource,
      revision,
      documentContext,
      conversations,
      messages,
      versions,
      activeConversation?.id,
      uxAnalysis,
      decisions,
      candidatesMap,
      candidate,
      selectedFindingIds,
      sidebarWidth,
      isSidebarCollapsed,
    ]
  );

  // Autosave scheduling
  const scheduleAutosave = useCallback(
    (sourceToSave?: string, revToSave?: number) => {
      setSaveStatus("unsaved");
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        setSaveStatus("saving");
        persistProject(sourceToSave, revToSave);
      }, EDITOR_CONFIG.AUTOSAVE_DEBOUNCE_MS);
    },
    [persistProject]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveProjectToStorage({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      document: {
        source: canonicalSource,
        revision,
        context: documentContext,
      },
      conversations,
      messages,
      versions,
      activeConversationId: activeConversation?.id ?? null,
      review: {
        analysis: uxAnalysis,
        decisions,
        candidates: Array.from(candidatesMap.values()),
        activeCandidateId: candidate?.result.id ?? null,
        selectedFindingIds,
      },
      sidebar: {
        width: sidebarWidth,
        isCollapsed: isSidebarCollapsed,
      },
      timestamp: Date.now(),
    });
  }, [
    canonicalSource,
    revision,
    documentContext,
    conversations,
    messages,
    versions,
    activeConversation?.id,
    uxAnalysis,
    decisions,
    candidatesMap,
    candidate,
    selectedFindingIds,
    sidebarWidth,
    isSidebarCollapsed,
  ]);

  // Active candidate with automatic stale detection
  const activeCandidate = useMemo(() => {
    if (!candidate) return null;
    if (candidate.status === "ready" && candidate.result.basedOnRevision < revision) {
      return { ...candidate, status: "stale" as const };
    }
    return candidate;
  }, [candidate, revision]);

  // Preview Candidate action
  const handlePreviewCandidate = useCallback(
    (cand: GenerationCandidate) => {
      setCandidate(cand);
      setIsComparingOriginal(false);
      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: cand.sanitizedHtml,
          revision,
        },
      });
    },
    [sessionId, revision, sendToIframe]
  );

  // Toggle Compare between Current and Candidate
  const handleToggleCompare = useCallback(() => {
    if (!candidate) return;
    setIsComparingOriginal((prev) => {
      const nextComparing = !prev;
      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: nextComparing ? canonicalSource : candidate.sanitizedHtml,
          revision,
        },
      });
      return nextComparing;
    });
  }, [candidate, canonicalSource, revision, sessionId, sendToIframe]);

  // Exit preview mode
  const handleExitPreview = useCallback(() => {
    setCandidate(null);
    setIsComparingOriginal(false);
    sendToIframe({
      source: "visual-editor-parent",
      type: "SET_DOCUMENT_SOURCE",
      payload: {
        sessionId,
        source: canonicalSource,
        revision,
      },
    });
  }, [canonicalSource, revision, sessionId, sendToIframe]);

  // Apply Candidate Generation atomically
  const handleApplyCandidate = useCallback(
    (cand: GenerationCandidate) => {
      if (cand.status !== "ready" || cand.result.basedOnRevision !== revision) return;

      const nextRev = revision + 1;
      setCanonicalSource(cand.sanitizedHtml);
      setRevision(nextRev);

      historyManager.push(
        cand.sanitizedHtml,
        null,
        `AI Generation: ${cand.result.summary}`
      );
      updateHistoryState();

      const appliedVersion = addVersion({
        source: "ai-generation",
        revision: nextRev,
        htmlReference: cand.sanitizedHtml,
        summary: cand.result.summary,
      });
      setDecisions(prev => prev.map(d => d.candidateId === cand.result.id ? { ...d, appliedVersionId: appliedVersion.id } : d));

      addTimelineEvent("generation-applied", `Applied generation: "${cand.result.summary}"`);

      const appliedCandidate: GenerationCandidate = { ...cand, status: "applied" };
      setCandidate(null);
      setIsComparingOriginal(false);
      setCandidatesMap((prev) => new Map(prev).set(cand.result.id, appliedCandidate));

      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: cand.sanitizedHtml,
          revision: nextRev,
        },
      });

      scheduleAutosave(cand.sanitizedHtml, nextRev);
    },
    [
      revision,
      historyManager,
      updateHistoryState,
      addVersion,
      addTimelineEvent,
      sendToIframe,
      sessionId,
      scheduleAutosave,
    ]
  );

  // Reject Candidate
  const handleRejectCandidate = useCallback(
    (cand: GenerationCandidate) => {
      const rejectedCandidate: GenerationCandidate = { ...cand, status: "rejected" };
      setCandidatesMap((prev) => new Map(prev).set(cand.result.id, rejectedCandidate));
      if (candidate?.result.id === cand.result.id) {
        handleExitPreview();
      }
      scheduleAutosave();
    },
    [candidate, handleExitPreview, scheduleAutosave]
  );

  // Apply Accepted AI Proposal atomically
  const handleApplyProposal = useCallback(() => {
    if (!activeProposal) return;
    if (activeProposal.basedOnRevision < revision) {
      return;
    }

    const simulation = simulateProposal(activeProposal, canonicalSource, revision);
    if (!simulation.canApply) {
      return;
    }

    const nextRev = revision + 1;
    setCanonicalSource(simulation.predictedSource);
    setRevision(nextRev);

    const nextSelected = simulation.affectedNodeIds[0] || selectedId;
    if (nextSelected) {
      setSelectedId(nextSelected);
    }

    historyManager.push(
      simulation.predictedSource,
      nextSelected,
      `AI Edit: ${activeProposal.summary}`
    );
    updateHistoryState();

    addVersion({
      source: "ai-edit",
      revision: nextRev,
      htmlReference: simulation.predictedSource,
      summary: activeProposal.summary,
    });

    addTimelineEvent("proposal-applied", `Applied AI edit: "${activeProposal.summary}"`);

    sendToIframe({
      source: "visual-editor-parent",
      type: "SET_DOCUMENT_SOURCE",
      payload: {
        sessionId,
        source: simulation.predictedSource,
        revision: nextRev,
      },
    });

    setActiveProposal(null);
    scheduleAutosave(simulation.predictedSource, nextRev);
  }, [
    activeProposal,
    revision,
    canonicalSource,
    selectedId,
    historyManager,
    updateHistoryState,
    addVersion,
    addTimelineEvent,
    sendToIframe,
    sessionId,
    scheduleAutosave,
  ]);

  const handleRejectProposal = useCallback(() => {
    setActiveProposal(null);
  }, []);

  // Restore Document Version
  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      const nextRev = revision + 1;
      const restoreResult = restoreVersion(versionId, nextRev);
      if (!restoreResult) return;

      const restoredHtml = restoreResult.targetVersion.htmlReference;
      setCanonicalSource(restoredHtml);
      setRevision(nextRev);
      setSelectedId(null);
      setSelectedRect(null);
      setSelectedTagName(null);

      historyManager.push(
        restoredHtml,
        null,
        `Restored version Rev ${restoreResult.targetVersion.revision}`
      );
      updateHistoryState();

      addTimelineEvent(
        "version-restored",
        `Restored to version Rev ${restoreResult.targetVersion.revision} (${restoreResult.targetVersion.summary})`
      );

      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: restoredHtml,
          revision: nextRev,
        },
      });

      scheduleAutosave(restoredHtml, nextRev);
    },
    [
      revision,
      restoreVersion,
      historyManager,
      updateHistoryState,
      addTimelineEvent,
      sendToIframe,
      sessionId,
      scheduleAutosave,
    ]
  );

  // Apply Document Operation (Properties Panel)
  const handleApplyOperation = useCallback(
    (operation: EditorOperation) => {
      const result = applyOperationToDocument(canonicalSource, operation, revision);
      if (!result.ok) {
        console.error("Failed to apply operation:", result.message);
        return;
      }

      const nextRev = result.revision;
      setCanonicalSource(result.source);
      setRevision(nextRev);

      const targetSelected = result.newSelectedId !== undefined ? result.newSelectedId : selectedId;
      if (result.newSelectedId !== undefined) {
        setSelectedId(result.newSelectedId);
      }

      historyManager.push(result.source, targetSelected, operation.type);
      updateHistoryState();

      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: result.source,
          revision: nextRev,
        },
      });

      if (result.newSelectedId) {
        sendToIframe({
          source: "visual-editor-parent",
          type: "SELECT_NODE",
          payload: {
            sessionId,
            id: result.newSelectedId,
          },
        });
      }

      scheduleAutosave(result.source, nextRev);
    },
    [canonicalSource, revision, selectedId, historyManager, updateHistoryState, sendToIframe, sessionId, scheduleAutosave]
  );

  // Apply Code Mode Changes
  const handleApplyCodeChanges = useCallback(
    (newHtml: string) => {
      const reconciled = reconcileEditorIds(canonicalSource, newHtml);
      const nextRev = revision + 1;

      setCanonicalSource(reconciled.reconciledHtml);
      setRevision(nextRev);

      historyManager.push(reconciled.reconciledHtml, selectedId, "Code Mode Edit");
      updateHistoryState();

      addVersion({
        source: "code",
        revision: nextRev,
        htmlReference: reconciled.reconciledHtml,
        summary: "Direct HTML Code Edit",
      });

      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: reconciled.reconciledHtml,
          revision: nextRev,
        },
      });

      scheduleAutosave(reconciled.reconciledHtml, nextRev);
      setHasUnappliedCodeChanges(false);
    },
    [
      canonicalSource,
      revision,
      selectedId,
      sessionId,
      sendToIframe,
      scheduleAutosave,
      updateHistoryState,
      historyManager,
      addVersion,
    ]
  );

  // Undo action
  const handleUndo = useCallback(() => {
    const entry = historyManager.undo();
    if (!entry) return;

    const nextRev = revision + 1;
    setCanonicalSource(entry.source);
    setRevision(nextRev);
    setSelectedId(entry.selectedNodeId);
    setSelectedRect(null);
    setSelectedTagName(null);

    updateHistoryState();

    sendToIframe({
      source: "visual-editor-parent",
      type: "SET_DOCUMENT_SOURCE",
      payload: {
        sessionId,
        source: entry.source,
        revision: nextRev,
      },
    });

    if (entry.selectedNodeId) {
      sendToIframe({
        source: "visual-editor-parent",
        type: "SELECT_NODE",
        payload: {
          sessionId,
          id: entry.selectedNodeId,
        },
      });
    }

    scheduleAutosave(entry.source, nextRev);
  }, [historyManager, revision, updateHistoryState, sendToIframe, sessionId, scheduleAutosave]);

  // Redo action
  const handleRedo = useCallback(() => {
    const entry = historyManager.redo();
    if (!entry) return;

    const nextRev = revision + 1;
    setCanonicalSource(entry.source);
    setRevision(nextRev);
    setSelectedId(entry.selectedNodeId);
    setSelectedRect(null);
    setSelectedTagName(null);

    updateHistoryState();

    sendToIframe({
      source: "visual-editor-parent",
      type: "SET_DOCUMENT_SOURCE",
      payload: {
        sessionId,
        source: entry.source,
        revision: nextRev,
      },
    });

    if (entry.selectedNodeId) {
      sendToIframe({
        source: "visual-editor-parent",
        type: "SELECT_NODE",
        payload: {
          sessionId,
          id: entry.selectedNodeId,
        },
      });
    }

    scheduleAutosave(entry.source, nextRev);
  }, [historyManager, revision, updateHistoryState, sendToIframe, sessionId, scheduleAutosave]);

  // Global Keyboard Shortcuts (Undo / Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (
        (modifier && e.shiftKey && e.key.toLowerCase() === "z") ||
        (!isMac && modifier && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Reset Document action
  const handleResetDocument = useCallback(() => {
    clearDocumentFromStorage();
    const defaultDoc = getSampleTailwindDocument(sessionId);
    setCanonicalSource(defaultDoc);
    setRevision(1);
    setSelectedId(null);
    setSelectedRect(null);
    setSelectedTagName(null);
    setDocumentContext(getDefaultDocumentContext());
    setCandidate(null);

    historyManager.reset(defaultDoc, null);
    updateHistoryState();

    sendToIframe({
      source: "visual-editor-parent",
      type: "SET_DOCUMENT_SOURCE",
      payload: {
        sessionId,
        source: defaultDoc,
        revision: 1,
      },
    });

    setSaveStatus("saved");
  }, [sessionId, historyManager, updateHistoryState, sendToIframe]);

  // Commit Imported Website Document
  const handleImportComplete = useCallback(
    (data: {
      sanitizedHtml: string;
      designMarkdown: string;
      title: string;
      sourceUrl: string;
    }) => {
      const nextRevision = revision + 1;
      const nextContext: EditorDocumentContext = {
        title: data.title,
        sourceUrl: data.sourceUrl,
        designMarkdown: data.designMarkdown,
      };

      setDocumentContext(nextContext);
      historyManager.push(data.sanitizedHtml, null, `Import website: ${data.title}`);
      setCanonicalSource(data.sanitizedHtml);
      setRevision(nextRevision);
      setSelectedId(null);
      setSelectedRect(null);
      setSelectedTagName(null);
      setEditorMode("design");

      addVersion({
        source: "website-import",
        revision: nextRevision,
        htmlReference: data.sanitizedHtml,
        summary: `Imported website: ${data.title}`,
      });

      addTimelineEvent("website-import", `Imported website "${data.title}" from ${data.sourceUrl}`);

      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_EDITOR_MODE",
        payload: { sessionId, mode: "design" },
      });
      sendToIframe({
        source: "visual-editor-parent",
        type: "SET_DOCUMENT_SOURCE",
        payload: {
          sessionId,
          source: data.sanitizedHtml,
          revision: nextRevision,
        },
      });

      persistProject(data.sanitizedHtml, nextRevision, nextContext);
      updateHistoryState();
    },
    [
      revision,
      historyManager,
      sessionId,
      sendToIframe,
      updateHistoryState,
      persistProject,
      addVersion,
      addTimelineEvent,
    ]
  );

  // Mode change handler with unapplied changes safeguard
  const handleModeChange = useCallback(
    (targetMode: EditorMode) => {
      if (editorMode === "code" && targetMode !== "code" && hasUnappliedCodeChanges) {
        setPendingMode(targetMode);
        setShowLeaveCodeWarning(true);
        return;
      }
      setEditorMode(targetMode);
      if (targetMode === "preview" || targetMode === "design") {
        sendToIframe({
          source: "visual-editor-parent",
          type: "SET_EDITOR_MODE",
          payload: { sessionId, mode: targetMode },
        });
        // Start/end interaction tracking session
        if (targetMode === "preview") {
          interactionEvidence.startSession(sessionId, viewport as "desktop" | "tablet" | "mobile");
        } else {
          interactionEvidence.endSession();
        }
      }
    },
    [editorMode, hasUnappliedCodeChanges, sessionId, sendToIframe, interactionEvidence, viewport]
  );

  // Selection & Hover Handlers
  const handleSelectNode = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      sendToIframe({
        source: "visual-editor-parent",
        type: "SELECT_NODE",
        payload: { sessionId, id },
      });
    },
    [sessionId, sendToIframe]
  );

  const handleHoverNode = useCallback(
    (id: string | null) => {
      setHoveredId(id);
      sendToIframe({
        source: "visual-editor-parent",
        type: "HOVER_NODE",
        payload: { sessionId, id },
      });
    },
    [sessionId, sendToIframe]
  );

  const handleDuplicateNode = useCallback(
    (id: string) => {
      handleApplyOperation({
        type: "duplicate_node",
        nodeId: id,
      });
    },
    [handleApplyOperation]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      handleApplyOperation({
        type: "delete_node",
        nodeId: id,
      });
    },
    [handleApplyOperation]
  );

  const handleIframeLoad = useCallback(() => {
    sendToIframe({
      source: "visual-editor-parent",
      type: "HANDSHAKE",
      payload: { sessionId },
    });
  }, [sessionId, sendToIframe]);

  // Message listener for iframe bridge
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      const message = parseIframeMessage(event.data, sessionId);
      if (!message) return;

      switch (message.type) {
        case "IFRAME_READY": {
          sendToIframe({
            source: "visual-editor-parent",
            type: "SET_DOCUMENT_SOURCE",
            payload: {
              sessionId,
              source: activeCandidate ? activeCandidate.sanitizedHtml : canonicalSource,
              revision,
            },
          });
          break;
        }

        case "NODE_HOVERED":
          setHoveredId(message.payload.id);
          setHoveredRect(message.payload.rect);
          setHoveredTagName(message.payload.tagName);
          break;

        case "NODE_SELECTED":
          setSelectedId(message.payload.id);
          setSelectedRect(message.payload.rect);
          setSelectedTagName(message.payload.tagName);
          break;

        case "RECTS_UPDATED":
          if (message.payload.selectedRect !== undefined) {
            setSelectedRect(message.payload.selectedRect);
          }
          if (message.payload.hoveredRect !== undefined) {
            setHoveredRect(message.payload.hoveredRect);
          }
          break;

        case "DOCUMENT_MUTATED":
          setDocumentTree(message.payload.documentTree);
          break;

        case "INTERACTION_EVENT":
          interactionEvidence.processEvent(message.payload.event);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sessionId, revision, canonicalSource, activeCandidate, sendToIframe, interactionEvidence]);

  // Active handshake connection until documentTree is received
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      if (documentTree || attempts > 30) {
        clearInterval(interval);
        return;
      }
      attempts++;
      sendToIframe({
        source: "visual-editor-parent",
        type: "HANDSHAKE",
        payload: { sessionId },
      });
    }, 500);

    return () => clearInterval(interval);
  }, [sessionId, documentTree, sendToIframe]);

  // Breadcrumbs path
  const selectionPathNodes = useMemo(() => {
    if (!documentTree || !selectedId) return [];
    return getNodePath(documentTree, selectedId);
  }, [documentTree, selectedId]);

  const selectedNode = useMemo(() => {
    if (!documentTree || !selectedId) return null;
    return findNodeById(documentTree, selectedId);
  }, [documentTree, selectedId]);

  return (
    <div
      className={`flex flex-col h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans transition-colors ${theme}`}
    >
      {/* Top Application Toolbar */}
      <Toolbar
        viewport={viewport}
        onViewportChange={setViewport}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        onWidthChange={setFrameWidth}
        onHeightChange={setFrameHeight}
        onAdjustWidth={adjustWidth}
        onAdjustHeight={adjustHeight}
        onResetFrameSize={resetFrameSize}
        editorMode={editorMode}
        onModeChange={handleModeChange}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        selectedId={selectedId}
        selectedTagName={selectedTagName}
        selectionPathNodes={selectionPathNodes}
        onSelectNode={handleSelectNode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        saveStatus={saveStatus}
        onResetDocument={handleResetDocument}
        onOpenAIComposer={() => {
          toggleSidebarCollapse();
        }}
        isAIActive={!isSidebarCollapsed}
        onToggleLayers={toggleLayersCollapse}
        isLayersActive={!isLayersCollapsed}
        onOpenImportDialog={() => setShowImportDialog(true)}
        onOpenVersionHistory={() => setShowVersionHistoryDialog(true)}
        onOpenPublish={() => setShowPublishDialog(true)}
        onOpenOptimization={() => {
          if (isRightSidebarCollapsed) {
            setRightSidebarTab("optimization");
            toggleRightSidebarCollapse();
          } else if (rightSidebarTab === "optimization") {
            toggleRightSidebarCollapse();
          } else {
            setRightSidebarTab("optimization");
          }
        }}
        isOptimizationActive={!isRightSidebarCollapsed && rightSidebarTab === "optimization"}
      />

      <ProjectOverview
        projectId={projectId} pageId={pageId} versions={versions} revision={revision}
        review={{ analysis: uxAnalysis, decisions, candidates: Array.from(candidatesMap.values()), activeCandidateId: candidate?.result.id ?? null, selectedFindingIds }}
        candidate={activeCandidate} previewEvents={interactionEvidence.summary?.totalEvents ?? 0}
        refreshTrigger={reviewRefresh}
        onAction={(action, experimentId) => {
          if (action === "generate") { if (isSidebarCollapsed) toggleSidebarCollapse(); return; }
          if (action === "publish") { setShowPublishDialog(true); return; }
          if (action === "experiment") { setShowCreateExperimentDialog(true); return; }
          setRightSidebarTab("optimization");
          if (isRightSidebarCollapsed) toggleRightSidebarCollapse();
          setOptimizationEvidenceMode(action === "review" ? "experiment" : "preview");
          if (experimentId) setActiveExperimentId(experimentId);
          if (action === "compare" && candidate) handlePreviewCandidate(candidate);
        }}
      />
      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Sidebar: Left persistent sidebar */}
        <ChatSidebar
          width={sidebarWidth}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          onMouseDownResize={handleSidebarMouseDown}
          onKeyDownResize={handleSidebarKeyDown}
          conversations={conversations}
          activeConversation={activeConversation}
          messages={messages}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          selectedNode={selectedNode}
          documentRevision={revision}
          documentContext={documentContext}
          isProcessing={isProcessing}
          currentStage={currentStage}
          candidatesMap={candidatesMap}
          previewingCandidateId={candidate ? candidate.result.id : null}
          onReviewProposal={() => {
            if (activeProposal) {
              // Open modal
            }
          }}
          onPreviewCandidate={handlePreviewCandidate}
          onCompareCandidate={handleToggleCompare}
          onApplyCandidate={handleApplyCandidate}
          onRejectCandidate={handleRejectCandidate}
          onReviseCandidate={(cand) => {
            handlePreviewCandidate(cand);
          }}
          onSendEdit={(instruction, scope) =>
            submitEdit(instruction, scope, [])
          }
          onSendGenerate={(instruction, scope, attachments, genContext, provider) =>
            submitGenerate(instruction, scope, attachments, genContext, provider)
          }
          onCancel={handleCancelAI}
        />

        {editorMode === "code" ? (
          <div className="flex-1 flex overflow-hidden">
            <CodeEditorPanel
              canonicalSource={activeCandidate ? activeCandidate.sanitizedHtml : canonicalSource}
              revision={revision}
              onApplyCodeChanges={handleApplyCodeChanges}
              onDraftChange={setHasUnappliedCodeChanges}
              theme={theme}
            />
          </div>
        ) : (
          <>
            {/* Layers Panel: active in Design Mode */}
            {editorMode === "design" && (
              <LayersPanel
                documentTree={documentTree}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelectNode={handleSelectNode}
                onHoverNode={handleHoverNode}
                width={layersWidth}
                isCollapsed={isLayersCollapsed}
                onToggleCollapse={toggleLayersCollapse}
                onMouseDownResize={handleLayersMouseDown}
                onKeyDownResize={handleLayersKeyDown}
              />
            )}

            {/* Central Canvas Frame with Candidate Preview Banner */}
            <div className="relative flex-1 flex overflow-hidden">
              {activeCandidate && (
                <GenerationPreviewBanner
                  candidate={activeCandidate}
                  isComparingOriginal={isComparingOriginal}
                  onToggleCompare={handleToggleCompare}
                  onApply={handleApplyCandidate}
                  onExitPreview={handleExitPreview}
                />
              )}
              <ViewportCanvas
                viewport={viewport}
                sessionId={sessionId}
                iframeRef={iframeRef}
                selectedRect={selectedRect}
                selectedTagName={selectedTagName}
                selectedId={selectedId}
                hoveredRect={hoveredRect}
                hoveredTagName={hoveredTagName}
                hoveredId={hoveredId}
                onIframeLoad={handleIframeLoad}
                editorMode={editorMode}
                frameWidth={frameWidth}
                frameHeight={frameHeight}
                isResizing={isResizingFrame}
                onStartResize={startFrameResize}
                onResetFrameSize={resetFrameSize}
              />
            </div>

            {/* Right Sidebar: Properties & Optimization Panels in Design Mode */}
            {editorMode === "design" && (
              isRightSidebarCollapsed ? (
                <aside
                  className="w-10 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-2 shrink-0 h-full select-none transition-colors gap-2"
                  data-testid="right-sidebar-collapsed"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setRightSidebarTab("properties");
                      toggleRightSidebarCollapse();
                    }}
                    title="Open Properties"
                    data-testid="right-sidebar-expand-properties-btn"
                    className={`h-7 w-7 ${
                      rightSidebarTab === "properties"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setRightSidebarTab("optimization");
                      toggleRightSidebarCollapse();
                    }}
                    title="Open UX Analyzer"
                    data-testid="right-sidebar-expand-optimization-btn"
                    className={`h-7 w-7 ${
                      rightSidebarTab === "optimization"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                  </Button>
                </aside>
              ) : (
                <div
                  className="relative flex flex-col h-full shrink-0 select-none"
                  style={{ width: `${rightSidebarWidth}px` }}
                  data-testid="right-sidebar-container"
                >
                  {/* Left resizer for right sidebar */}
                  <div
                    className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-30"
                    onMouseDown={handleRightSidebarMouseDown}
                    onKeyDown={handleRightSidebarKeyDown}
                    role="separator"
                    aria-label="Resize right sidebar"
                    data-testid="right-sidebar-resizer"
                    tabIndex={0}
                  />

                  {/* Tab switcher + Close Button */}
                  <div className="h-8 px-2 bg-zinc-100/90 dark:bg-zinc-900/90 border-l border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 select-none z-10">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid="tab-properties"
                        onClick={() => setRightSidebarTab("properties")}
                        className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                          rightSidebarTab === "properties"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        Properties
                      </button>
                      <button
                        type="button"
                        data-testid="tab-optimization"
                        onClick={() => setRightSidebarTab("optimization")}
                        className={`px-2.5 py-0.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer ${
                          rightSidebarTab === "optimization"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>UX Analyzer</span>
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleRightSidebarCollapse}
                      title="Collapse Panel"
                      data-testid="right-sidebar-collapse-btn"
                      className="h-6 w-6 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {rightSidebarTab === "properties" ? (
                      <PropertiesPanel
                        selectedNode={selectedNode}
                        breadcrumbNodes={selectionPathNodes}
                        onApplyOperation={handleApplyOperation}
                        onDuplicateNode={handleDuplicateNode}
                        onDeleteNode={handleDeleteNode}
                      />
                    ) : (
                      <OptimizationPanel
                        canonicalHtml={canonicalSource}
                        projectId={projectId}
                        pageId={pageId}
                        currentRevision={revision}
                        currentVersionId={versions.find(v => v.revision === revision)?.id}
                        selectedId={selectedId}
                        onSelectNode={handleSelectNode}
                        viewport={viewport}
                        onViewportChange={setViewport}
                        analysis={uxAnalysis}
                        onAnalysisChange={setUxAnalysis}
                        onOptimizationResultReady={handleOptimizationCandidateReady}
                        candidate={activeCandidate}
                        onApplyCandidate={handleApplyCandidate}
                        onRejectCandidate={handleRejectCandidate}
                        interactionSummary={interactionEvidence.summary}
                        initialEvidenceMode={optimizationEvidenceMode}
                        activeExperimentId={activeExperimentId}
                        initialSelectedFindingIds={selectedFindingIds}
                        onSelectedFindingsChange={setSelectedFindingIds}
                        onWorkflowChange={() => setReviewRefresh(n => n + 1)}
                      />
                    )}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* AI Proposal Review Modal */}
      <AIProposalReview
        proposal={activeProposal}
        scope={proposalScope}
        canonicalSource={canonicalSource}
        currentRevision={revision}
        onApply={handleApplyProposal}
        onReject={handleRejectProposal}
      />

      {/* Website Import Dialog */}
      <ImportWebsiteDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Version History Dialog */}
      <VersionHistoryDialog
        isOpen={showVersionHistoryDialog}
        onClose={() => setShowVersionHistoryDialog(false)}
        versions={versions}
        currentRevision={revision}
        onRestoreVersion={handleRestoreVersion}
        onCreateExperiment={handleOpenCreateExperiment}
      />

      {/* Create Experiment Dialog */}
      <CreateExperimentDialog
        isOpen={showCreateExperimentDialog}
        onClose={() => setShowCreateExperimentDialog(false)}
        projectId={projectId}
        pageId={pageId}
        initialControlVersionId={expControlVersionId}
        initialVariantVersionId={expVariantVersionId}
        onCreated={(exp) => {
          setReviewRefresh(n => n + 1);
          if (isRightSidebarCollapsed) toggleRightSidebarCollapse();
          setRightSidebarTab("optimization");
          setOptimizationEvidenceMode("experiment");
          setActiveExperimentId(exp.id);
        }}
      />

      {/* Discard Unapplied Code Changes Confirmation Dialog */}
      <Dialog open={showLeaveCodeWarning} onOpenChange={setShowLeaveCodeWarning}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard Unapplied Code Changes?</DialogTitle>
            <DialogDescription>
              You have unapplied edits in the HTML code draft. Leaving Code Mode now will discard those changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowLeaveCodeWarning(false);
                setPendingMode(null);
              }}
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              size="sm"
              data-testid="btn-confirm-discard-code"
              onClick={() => {
                setShowLeaveCodeWarning(false);
                setHasUnappliedCodeChanges(false);
                if (pendingMode) {
                  setEditorMode(pendingMode);
                  if (pendingMode === "preview" || pendingMode === "design") {
                    sendToIframe({
                      source: "visual-editor-parent",
                      type: "SET_EDITOR_MODE",
                      payload: { sessionId, mode: pendingMode },
                    });
                  }
                  setPendingMode(null);
                }
              }}
            >
              Discard & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish and Deploy Dialog */}
      <PublishDialog
        key={`${showPublishDialog}-${revision}`}
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        canonicalHtml={canonicalSource}
        currentRevision={revision}
        versions={versions}
        projectId={projectId}
        pageId={pageId}
        onPublished={() => setReviewRefresh(n => n + 1)}
      />
    </div>
  );
}
