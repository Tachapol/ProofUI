"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Clock,
  TrendingUp,
  Minus,
  AlertTriangle,
  ShieldAlert,
  Check,
  X,
  Zap,
  MousePointer2,
  ArrowDown,
  FormInput,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  UXAnalysisResult,
  UXAnalysisViewport,
  UXAnalyzeStage,
  UXAnalyzeStreamEvent,
  UXSeverity,
  UXCategory,
  isFindingAutomatable,
  UXOptimizationStage,
  OptimizationComparison,
} from "@/lib/optimization/schemas";
import { PageGenerationResult, GenerationCandidate } from "@/lib/generation/schemas";
import { InteractionSessionSummary } from "@/lib/interaction/schemas";
import { AggregatedProductionEvidence } from "@/lib/production/schemas";
import { ProductionEvidenceDashboard } from "./ProductionEvidenceDashboard";

interface OptimizationPanelProps {
  canonicalHtml: string;
  projectId?: string;
  currentRevision: number;
  selectedId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  viewport?: "desktop" | "tablet" | "mobile";
  onViewportChange?: (vp: "desktop" | "tablet" | "mobile") => void;
  analysis?: UXAnalysisResult | null;
  onAnalysisChange?: (analysis: UXAnalysisResult | null) => void;
  onOptimizationResultReady?: (result: PageGenerationResult) => void;
  candidate?: GenerationCandidate | null;
  onApplyCandidate?: (candidate: GenerationCandidate) => void;
  onRejectCandidate?: (candidate: GenerationCandidate) => void;
  interactionSummary?: InteractionSessionSummary | null;
}

export function OptimizationPanel({
  canonicalHtml,
  projectId = "proj_default",
  currentRevision,
  selectedId,
  onSelectNode,
  viewport: externalViewport,
  onViewportChange,
  analysis: analysisProp,
  onAnalysisChange,
  onOptimizationResultReady,
  candidate,
  onApplyCandidate,
  onRejectCandidate,
  interactionSummary,
}: OptimizationPanelProps) {
  const comparison: OptimizationComparison | undefined = useMemo(() => {
    if (!candidate) return undefined;
    return (
      candidate.optimizationComparison ||
      (candidate.result as { optimizationComparison?: OptimizationComparison; comparison?: OptimizationComparison })?.optimizationComparison ||
      (candidate.result as { optimizationComparison?: OptimizationComparison; comparison?: OptimizationComparison })?.comparison
    );
  }, [candidate]);

  const [internalAnalysis, setInternalAnalysis] = useState<UXAnalysisResult | null>(null);
  const analysis = analysisProp !== undefined ? analysisProp : internalAnalysis;
  const setAnalysis = useCallback(
    (res: UXAnalysisResult | null) => {
      setInternalAnalysis(res);
      if (onAnalysisChange) {
        onAnalysisChange(res);
      }
    },
    [onAnalysisChange]
  );
  const [internalViewport, setInternalViewport] = useState<UXAnalysisViewport>("desktop");
  const selectedViewport: UXAnalysisViewport = (externalViewport as UXAnalysisViewport) || internalViewport;
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStage, setCurrentStage] = useState<UXAnalyzeStage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [evidenceMode, setEvidenceMode] = useState<"preview" | "production">("preview");

  // Filters
  const [selectedSeverity, setSelectedSeverity] = useState<UXSeverity | "all">(
    "all"
  );
  const [selectedCategory, setSelectedCategory] = useState<UXCategory | "all">(
    "all"
  );

  const handleViewportSelect = (vp: UXAnalysisViewport) => {
    setInternalViewport(vp);
    if (onViewportChange) {
      onViewportChange(vp);
    }
  };

  // Selected findings for AI Optimization Candidate
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  // Run UX Analysis with SSE
  const handleAnalyze = useCallback(async (liveEvidenceToUse?: AggregatedProductionEvidence | null) => {
    setIsAnalyzing(true);
    setCurrentStage("Preparing document");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/optimization/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          html: canonicalHtml,
          viewport: selectedViewport,
          revision: currentRevision,
          liveEvidence: liveEvidenceToUse || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("No response body received for streaming.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const rawData = trimmed.slice(6);
            const event: UXAnalyzeStreamEvent = JSON.parse(rawData);

            if (event.type === "status") {
              setCurrentStage(event.stage);
            } else if (event.type === "result") {
              setAnalysis(event.result);
              if (liveEvidenceToUse) {
                const liveFindings = event.result.findings.filter((f) => f.category === "conversion");
                if (liveFindings.length > 0) {
                  setSelectedFindingIds(new Set(liveFindings.map((f) => f.id)));
                }
              }
            } else if (event.type === "error") {
              setErrorMessage(event.error);
            }
          } catch {
            // Ignore partial SSE parsing noise
          }
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run UX analyzer."
      );
    } finally {
      setIsAnalyzing(false);
      setCurrentStage(null);
    }
  }, [canonicalHtml, selectedViewport, currentRevision, setAnalysis, setSelectedFindingIds]);

  const handleCreateOptimizationFromLiveEvidence = useCallback(
    async (evidence: AggregatedProductionEvidence) => {
      await handleAnalyze(evidence);
    },
    [handleAnalyze]
  );

  // Is analysis stale?
  const isStale = useMemo(() => {
    return (
      analysis !== null &&
      analysis.documentRevision !== currentRevision
    );
  }, [analysis, currentRevision]);

  const [userGoal, setUserGoal] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizingStage, setOptimizingStage] = useState<UXOptimizationStage | null>(null);
  const [optimizingElapsed, setOptimizingElapsed] = useState<number>(0);

  useEffect(() => {
    if (!isOptimizing) return;
    const start = Date.now();
    const interval = setInterval(() => {
      setOptimizingElapsed(Math.max(0, (Date.now() - start) / 1000));
    }, 100);
    return () => {
      clearInterval(interval);
    };
  }, [isOptimizing]);

  const automatableFindings = useMemo(() => {
    if (!analysis) return [];
    return analysis.findings.filter(isFindingAutomatable);
  }, [analysis]);

  const hasAutomatableSelected = useMemo(() => {
    if (!analysis) return false;
    return analysis.findings.some(
      (f) => selectedFindingIds.has(f.id) && isFindingAutomatable(f)
    );
  }, [analysis, selectedFindingIds]);

  const toggleFindingSelection = (id: string) => {
    setSelectedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFindings = () => {
    if (selectedFindingIds.size === automatableFindings.length && automatableFindings.length > 0) {
      setSelectedFindingIds(new Set());
    } else {
      setSelectedFindingIds(new Set(automatableFindings.map((f) => f.id)));
    }
  };

  const handleGenerateCandidate = useCallback(async () => {
    if (!analysis || selectedFindingIds.size === 0 || isOptimizing) return;

    const selectedFindings = analysis.findings.filter((f) =>
      selectedFindingIds.has(f.id)
    );

    setIsOptimizing(true);
    setOptimizingStage("Preparing context");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/optimization/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          html: canonicalHtml,
          revision: currentRevision,
          viewport: selectedViewport,
          selectedFindingIds: Array.from(selectedFindingIds),
          selectedFindings,
          userGoal: userGoal.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Optimization request failed (${response.status})`
        );
      }

      if (!response.body) {
        throw new Error("No response body received for optimization stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "status") {
              setOptimizingStage(event.stage);
            } else if (event.type === "result") {
              onOptimizationResultReady?.(event.result);
            } else if (event.type === "error") {
              setErrorMessage(event.error);
            }
          } catch {}
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate optimization candidate"
      );
    } finally {
      setIsOptimizing(false);
      setOptimizingStage(null);
    }
  }, [
    analysis,
    selectedFindingIds,
    isOptimizing,
    canonicalHtml,
    currentRevision,
    selectedViewport,
    userGoal,
    onOptimizationResultReady,
  ]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    if (!analysis) return [];
    return analysis.findings.filter((f) => {
      if (selectedSeverity !== "all" && f.severity !== selectedSeverity) {
        return false;
      }
      if (selectedCategory !== "all" && f.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [analysis, selectedSeverity, selectedCategory]);

  return (
    <aside
      className="w-full bg-white dark:bg-zinc-950 flex flex-col shrink-0 h-full overflow-hidden select-none transition-colors"
      data-testid="optimization-panel"
    >
      {/* Header */}
      <div className="h-10 px-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>UX Analyzer</span>
        </div>

        {/* Viewport switcher */}
        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            data-testid="opt-viewport-desktop"
            onClick={() => handleViewportSelect("desktop")}
            className={`p-1 rounded transition-colors ${
              selectedViewport === "desktop"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            title="Desktop analysis"
          >
            <Monitor className="w-3 h-3" />
          </button>
          <button
            type="button"
            data-testid="opt-viewport-tablet"
            onClick={() => handleViewportSelect("tablet")}
            className={`p-1 rounded transition-colors ${
              selectedViewport === "tablet"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            title="Tablet analysis"
          >
            <Tablet className="w-3 h-3" />
          </button>
          <button
            type="button"
            data-testid="opt-viewport-mobile"
            onClick={() => handleViewportSelect("mobile")}
            className={`p-1 rounded transition-colors ${
              selectedViewport === "mobile"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
            title="Mobile analysis"
          >
            <Smartphone className="w-3 h-3" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Main Action Button */}
          <div>
            <Button
              className="w-full gap-2 font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing}
              data-testid="btn-analyze-ux"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {currentStage ? `${currentStage}...` : "Analyzing..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{analysis ? "Re-analyze UX" : "Analyze UX"}</span>
                </>
              )}
            </Button>
          </div>

          {/* Stale Analysis Alert */}
          {isStale && (
            <div
              data-testid="analysis-stale-badge"
              className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs"
            >
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1">
                <p className="font-semibold">Analysis is Outdated</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Document modified (rev #{analysis?.documentRevision} → #{currentRevision}).
                  Run analysis again to update findings.
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="btn-reanalyze-after-apply"
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="mt-2 text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3 h-3 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span>Analyze UX again</span>
                </Button>
              </div>
            </div>
          )}

          {/* Before/After Evidence Comparison Card */}
          {comparison && (
            <div
              data-testid="optimization-comparison-card"
              className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-500/30 dark:border-indigo-500/30 space-y-3"
            >
              {/* Header & Score Delta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Evidence Comparison
                  </span>
                </div>
                <Badge
                  variant={comparison.hasMeasurableImprovement ? "success" : "secondary"}
                  className="text-[10px]"
                >
                  {comparison.hasMeasurableImprovement ? "Improvement" : "No Score Gain"}
                </Badge>
              </div>

              {/* Score Display */}
              <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                    UX Score Comparison
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      data-testid="comparison-score-delta"
                      className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100"
                    >
                      UX score: {comparison.baselineScore} → {comparison.candidateScore}{" "}
                      ({comparison.scoreDelta >= 0 ? `+${comparison.scoreDelta}` : comparison.scoreDelta})
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {comparison.hasMeasurableImprovement ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{comparison.scoreDelta}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-zinc-500">
                      <Minus className="w-3.5 h-3.5" />
                      {comparison.scoreDelta}
                    </span>
                  )}
                </div>
              </div>

              {/* Token Usage & Generation Duration */}
              {candidate?.usage && (
                <div
                  data-testid="optimization-token-usage"
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500"
                >
                  <div className="flex items-center gap-1.5">
                    <span>In: <strong className="text-zinc-700 dark:text-zinc-300">{candidate.usage.promptTokens.toLocaleString()}</strong></span>
                    <span>•</span>
                    <span>Out: <strong className="text-zinc-700 dark:text-zinc-300">{candidate.usage.completionTokens.toLocaleString()}</strong></span>
                  </div>
                  {candidate.durationMs && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />
                      {(candidate.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}

              {/* No Measurable Improvement Alert */}
              {!comparison.hasMeasurableImprovement && (
                <div
                  data-testid="comparison-no-improvement-alert"
                  className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span className="font-medium">No measurable improvement</span>
                </div>
              )}

              {/* New Critical Issues Alert */}
              {comparison.hasNewCriticalIssues && (
                <div
                  data-testid="comparison-new-critical-alert"
                  className="p-2.5 rounded-lg bg-rose-500/10 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div>
                    <p className="font-bold">⚠️ New Critical Issues Detected</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      The candidate introduces critical issues not in baseline.
                    </p>
                  </div>
                </div>
              )}

              {/* Comparison Breakdown Sections */}
              <div className="space-y-2 text-xs">
                {/* 1. Resolved Issues */}
                <div
                  data-testid="comparison-resolved-section"
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolved Issues ({comparison.resolvedFindings.length})</span>
                    </div>
                  </div>
                  {comparison.resolvedFindings.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">None resolved</p>
                  ) : (
                    <div className="space-y-1.5">
                      {comparison.resolvedFindings.map((finding) => (
                        <div
                          key={`res-${finding.id}`}
                          className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1 cursor-pointer hover:border-emerald-400/50 transition-colors"
                          onClick={() => {
                            if (finding.affectedNodeIds.length > 0) {
                              onSelectNode(finding.affectedNodeIds[0]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {finding.title}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-500/10 px-1 py-0.5 rounded">
                              Resolved
                            </span>
                          </div>
                          {finding.affectedNodeIds.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-zinc-400">Node:</span>
                              {finding.affectedNodeIds.map((nodeId) => (
                                <button
                                  key={nodeId}
                                  type="button"
                                  data-testid={`comparison-node-${nodeId}`}
                                  onClick={() => onSelectNode(nodeId)}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono border bg-zinc-50 dark:bg-zinc-800 hover:border-indigo-400 cursor-pointer"
                                >
                                  #{nodeId}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Remaining Issues */}
                <div
                  data-testid="comparison-remaining-section"
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between font-semibold text-zinc-700 dark:text-zinc-300">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Remaining Issues ({comparison.remainingFindings.length})</span>
                    </div>
                  </div>
                  {comparison.remainingFindings.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">No remaining issues</p>
                  ) : (
                    <div className="space-y-1.5">
                      {comparison.remainingFindings.map((finding) => (
                        <div
                          key={`rem-${finding.id}`}
                          className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] space-y-1 cursor-pointer hover:border-zinc-400 transition-colors"
                          onClick={() => {
                            if (finding.affectedNodeIds.length > 0) {
                              onSelectNode(finding.affectedNodeIds[0]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {finding.title}
                            </span>
                            <span className="text-[9px] uppercase font-bold text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.5 rounded">
                              {finding.severity}
                            </span>
                          </div>
                          {finding.affectedNodeIds.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-zinc-400">Node:</span>
                              {finding.affectedNodeIds.map((nodeId) => (
                                <button
                                  key={nodeId}
                                  type="button"
                                  data-testid={`comparison-node-${nodeId}`}
                                  onClick={() => onSelectNode(nodeId)}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono border bg-zinc-50 dark:bg-zinc-800 hover:border-indigo-400 cursor-pointer"
                                >
                                  #{nodeId}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. New Issues */}
                <div
                  data-testid="comparison-new-section"
                  className={`rounded-lg border p-2.5 space-y-2 ${
                    comparison.newFindings.length > 0
                      ? "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>New Issues ({comparison.newFindings.length})</span>
                    </div>
                  </div>
                  {comparison.newFindings.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic">No new issues introduced</p>
                  ) : (
                    <div className="space-y-1.5">
                      {comparison.newFindings.map((finding) => (
                        <div
                          key={`new-${finding.id}`}
                          className="p-2 rounded bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/50 text-[11px] space-y-1 cursor-pointer hover:border-rose-400 transition-colors"
                          onClick={() => {
                            if (finding.affectedNodeIds.length > 0) {
                              onSelectNode(finding.affectedNodeIds[0]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {finding.title}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded ${
                                finding.severity === "critical"
                                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold"
                                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          {finding.evidence && (
                            <p className="text-[10px] text-zinc-500 font-mono break-all leading-tight">{finding.evidence}</p>
                          )}
                          {finding.affectedNodeIds.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-zinc-400">Node:</span>
                              {finding.affectedNodeIds.map((nodeId) => (
                                <button
                                  key={nodeId}
                                  type="button"
                                  data-testid={`comparison-node-${nodeId}`}
                                  onClick={() => onSelectNode(nodeId)}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono border bg-zinc-50 dark:bg-zinc-800 hover:border-indigo-400 cursor-pointer"
                                >
                                  #{nodeId}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Candidate Action Buttons */}
              {candidate && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    data-testid="btn-apply-comparison"
                    disabled={candidate.status === "stale"}
                    onClick={() => onApplyCandidate?.(candidate)}
                    className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Apply Candidate</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="btn-reject-comparison"
                    onClick={() => onRejectCandidate?.(candidate)}
                    className="text-xs h-8 text-zinc-600 dark:text-zinc-400"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    <span>Reject</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div
              data-testid="optimization-error-card"
              className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 shadow-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-rose-700 dark:text-rose-300">Operation Failed</p>
                <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
                title="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Analysis Results View */}
          {analysis ? (
            <div className="space-y-4">
              {/* Score Card */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                    UX Quality Score
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span
                      data-testid="ux-score"
                      className={`text-3xl font-extrabold tracking-tight ${
                        analysis.score >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : analysis.score >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {analysis.score}
                    </span>
                    <span className="text-xs text-zinc-400">/ 100</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 capitalize">
                    {analysis.viewport} viewport
                  </span>
                </div>

                {/* Score badge / status */}
                <div className="text-right">
                  <Badge
                    variant={
                      analysis.score >= 80
                        ? "success"
                        : analysis.score >= 60
                        ? "warning"
                        : "destructive"
                    }
                    className="font-medium text-[11px]"
                  >
                    {analysis.score >= 80
                      ? "Good"
                      : analysis.score >= 60
                      ? "Needs Work"
                      : "Critical Issues"}
                  </Badge>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    rev #{analysis.documentRevision}
                  </p>
                </div>
              </div>

              {/* Severity Breakdown Bar / Filters */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="count-critical"
                  onClick={() =>
                    setSelectedSeverity((prev) =>
                      prev === "critical" ? "all" : "critical"
                    )
                  }
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedSeverity === "critical"
                      ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {analysis.severityCounts.critical}
                  </div>
                  <div className="text-[10px] text-zinc-500">Critical</div>
                </button>

                <button
                  type="button"
                  data-testid="count-warning"
                  onClick={() =>
                    setSelectedSeverity((prev) =>
                      prev === "warning" ? "all" : "warning"
                    )
                  }
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedSeverity === "warning"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {analysis.severityCounts.warning}
                  </div>
                  <div className="text-[10px] text-zinc-500">Warning</div>
                </button>

                <button
                  type="button"
                  data-testid="count-info"
                  onClick={() =>
                    setSelectedSeverity((prev) =>
                      prev === "info" ? "all" : "info"
                    )
                  }
                  className={`p-2 rounded-lg border text-center transition-all ${
                    selectedSeverity === "info"
                      ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  }`}
                >
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {analysis.severityCounts.info}
                  </div>
                  <div className="text-[10px] text-zinc-500">Info</div>
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                {(
                  [
                    "all",
                    "accessibility",
                    "responsive",
                    "hierarchy",
                    "conversion",
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded-full capitalize whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* AI Optimization Candidate Generator */}
              <div className="p-3 rounded-xl bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-zinc-900 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Improve with AI
                    </span>
                  </div>
                  <span
                    data-testid="selected-finding-count"
                    className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full"
                  >
                    {selectedFindingIds.size} selected
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <button
                    type="button"
                    data-testid="btn-select-all-findings"
                    onClick={handleSelectAllFindings}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer underline text-[11px]"
                  >
                    {selectedFindingIds.size === automatableFindings.length && automatableFindings.length > 0
                      ? "Deselect all"
                      : "Select all automatable"}
                  </button>
                  <span className="text-[10px] text-zinc-400">
                    {automatableFindings.length} automatable
                  </span>
                </div>

                {/* Optional user goal input */}
                <div>
                  <input
                    type="text"
                    data-testid="optimization-user-goal-input"
                    value={userGoal}
                    onChange={(e) => setUserGoal(e.target.value)}
                    placeholder="Optional goal (e.g., focus on mobile layout)..."
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Progress Indicator or Action Button */}
                {isOptimizing ? (
                  <div className="space-y-1.5 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs">
                    <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Generating candidate...</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-mono">{optimizingStage}</span>
                        <span
                          data-testid="optimization-live-timer"
                          className="font-mono text-[10px] tabular-nums bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30"
                        >
                          {optimizingElapsed.toFixed(1)}s
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-indigo-200 dark:bg-indigo-950 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 animate-pulse rounded-full w-3/4" />
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    data-testid="btn-generate-optimization-candidate"
                    disabled={
                      isStale ||
                      selectedFindingIds.size === 0 ||
                      !hasAutomatableSelected ||
                      isAnalyzing
                    }
                    onClick={handleGenerateCandidate}
                    className="w-full text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Optimization Candidate</span>
                  </Button>
                )}

                {isStale && (
                  <p data-testid="stale-analysis-warning" className="text-[10px] text-amber-600 dark:text-amber-400">
                    Analysis is stale. Re-run analysis to generate improvements on the latest document revision.
                  </p>
                )}
              </div>

              {/* Findings List */}
              <div data-testid="findings-list" className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                  <span>
                    Findings ({filteredFindings.length} of{" "}
                    {analysis.findings.length})
                  </span>
                  {(selectedSeverity !== "all" ||
                    selectedCategory !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSeverity("all");
                        setSelectedCategory("all");
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline text-[10px]"
                    >
                      Reset filters
                    </button>
                  )}
                </div>

                {filteredFindings.length === 0 ? (
                  <div className="p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                      No issues found in this filter
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      All criteria for this category/severity passed.
                    </p>
                  </div>
                ) : (
                  filteredFindings.map((finding) => {
                    const isSelected = selectedFindingIds.has(finding.id);
                    const automatable = isFindingAutomatable(finding);

                    return (
                      <div
                        key={finding.id}
                        data-testid={`finding-${finding.id}`}
                        className={`p-3 rounded-xl border space-y-2 text-xs transition-all ${
                          isSelected
                            ? "bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-400/80 dark:border-indigo-600/80 shadow-xs"
                            : "bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            data-testid={`finding-checkbox-${finding.id}`}
                            checked={isSelected}
                            onChange={() => toggleFindingSelection(finding.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            title="Select finding for AI optimization"
                          />

                          <div className="flex-1 space-y-2 min-w-0">
                            {/* Severity & Category header */}
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    finding.severity === "critical"
                                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                      : finding.severity === "warning"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  }`}
                                >
                                  {finding.severity}
                                </span>
                                <span className="text-[10px] text-zinc-500 capitalize bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                  {finding.category}
                                </span>
                                {automatable && (
                                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                    Automatable
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {Math.round(finding.confidence * 100)}% conf
                              </span>
                            </div>

                            {/* Title */}
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs leading-snug">
                              {finding.title}
                            </p>

                            {/* Recommendation */}
                            <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                              {finding.recommendation}
                            </p>

                            {/* Evidence */}
                            <div className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-950 font-mono text-[10px] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-850 break-all leading-tight">
                              {finding.evidence}
                            </div>

                            {/* Affected Element Buttons */}
                            {finding.affectedNodeIds.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                <span className="text-[10px] text-zinc-400">
                                  Select:
                                </span>
                                {finding.affectedNodeIds.map((nodeId) => {
                                  const isNodeSelected = selectedId === nodeId;
                                  return (
                                    <button
                                      key={nodeId}
                                      type="button"
                                      data-testid={`affected-node-${nodeId}`}
                                      onClick={() => onSelectNode(nodeId)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                                        isNodeSelected
                                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                          : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                      }`}
                                    >
                                      #{nodeId}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-1">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Deterministic UX Audit
              </p>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[220px]">
                Inspect your landing page for WCAG accessibility, 390px mobile
                overflow, heading hierarchies, and conversion CTAs.
              </p>
            </div>
          )}

          {/* ─── Evidence Modes: Simulated Preview vs Production Live ─── */}
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setEvidenceMode("preview")}
                data-testid="tab-evidence-preview"
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors cursor-pointer ${
                  evidenceMode === "preview"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Simulated (Preview)
              </button>
              <button
                type="button"
                onClick={() => setEvidenceMode("production")}
                data-testid="tab-evidence-production"
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  evidenceMode === "production"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <Globe className="w-3 h-3 text-blue-500" />
                <span>Production (Live)</span>
              </button>
            </div>

            {evidenceMode === "preview" ? (
              interactionSummary && interactionSummary.totalEvents > 0 ? (
                <InteractionEvidenceSection
                  summary={interactionSummary}
                  onSelectNode={onSelectNode}
                  selectedId={selectedId}
                />
              ) : (
                <div className="p-3 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  Switch to Preview mode to simulate user interactions.
                </div>
              )
            ) : (
              <ProductionEvidenceDashboard
                projectId={projectId}
                onSelectNode={onSelectNode}
                selectedId={selectedId}
                onCreateOptimizationFromLiveEvidence={handleCreateOptimizationFromLiveEvidence}
                isCreatingOptimization={isAnalyzing}
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

// ─── Interaction Evidence Sub-Component ─────────────────────────────────

function InteractionEvidenceSection({
  summary,
  onSelectNode,
  selectedId,
}: {
  summary: InteractionSessionSummary;
  onSelectNode: (id: string | null) => void;
  selectedId: string | null;
}) {
  const [showZeroInteraction, setShowZeroInteraction] = useState(false);

  const sessionDurationSec = summary.timeOnPageMs / 1000;
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const scrollPercent = [
    summary.scrollDepth.reached100 ? 100 : 0,
    summary.scrollDepth.reached75 ? 75 : 0,
    summary.scrollDepth.reached50 ? 50 : 0,
    summary.scrollDepth.reached25 ? 25 : 0,
  ].find((v) => v > 0) || 0;

  const ctaEntries = Object.entries(summary.ctaClicks)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  const formEntries = Object.entries(summary.formInteractions)
    .map(([id, data]) => ({ id, ...data }))
    .filter((e) => e.focusCount > 0 || e.changeCount > 0);

  return (
    <div
      data-testid="interaction-evidence-section"
      className="p-3.5 rounded-xl bg-gradient-to-b from-violet-50/50 to-white dark:from-violet-950/20 dark:to-zinc-900 border border-violet-200/60 dark:border-violet-800/40 space-y-3 shadow-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            Interaction Evidence
          </span>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700"
        >
          {summary.totalEvents} events
        </Badge>
      </div>

      {/* Session Info */}
      <div
        data-testid="interaction-session-info"
        className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center justify-between"
      >
        <span>1 session · <span className="capitalize">{summary.viewport}</span> viewport</span>
        <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
          {formatDuration(sessionDurationSec)}
        </span>
      </div>

      {/* Scroll Depth */}
      <div data-testid="interaction-scroll-depth" className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold">
            <ArrowDown className="w-3 h-3 text-violet-500" />
            <span>Scroll Depth</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">{scrollPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
            style={{ width: `${scrollPercent}%` }}
          />
        </div>

        {/* Threshold Markers */}
        <div className="flex items-center justify-between text-[9px] text-zinc-400 px-0.5">
          {([25, 50, 75, 100] as const).map((t) => {
            const key = `reached${t}` as keyof typeof summary.scrollDepth;
            const reached = summary.scrollDepth[key];
            return (
              <span
                key={t}
                className={`font-mono ${
                  reached
                    ? "text-violet-600 dark:text-violet-400 font-bold"
                    : "text-zinc-400"
                }`}
              >
                {t}%{reached ? " ✓" : ""}
              </span>
            );
          })}
        </div>
      </div>

      {/* CTA Click Counts */}
      {ctaEntries.length > 0 && (
        <div data-testid="interaction-cta-clicks" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
            <MousePointer2 className="w-3 h-3 text-emerald-500" />
            <span>CTA Clicks ({ctaEntries.length})</span>
          </div>
          <div className="space-y-1">
            {ctaEntries.map(({ id, count }) => (
              <button
                key={`cta-${id}`}
                type="button"
                data-testid={`interaction-cta-${id}`}
                onClick={() => onSelectNode(id)}
                className={`w-full flex items-center justify-between p-1.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  selectedId === id
                    ? "bg-violet-50 dark:bg-violet-950/30 border-violet-400 dark:border-violet-600"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
              >
                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">#{id}</span>
                <Badge
                  variant="success"
                  className="text-[9px] ml-1 shrink-0"
                >
                  {count} click{count !== 1 ? "s" : ""}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Most Clicked Elements */}
      {summary.mostClickedElements.length > 0 && (
        <div data-testid="interaction-most-clicked" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
            <MousePointer2 className="w-3 h-3 text-blue-500" />
            <span>Most Clicked ({summary.mostClickedElements.length})</span>
          </div>
          <div className="space-y-1">
            {summary.mostClickedElements.slice(0, 5).map(({ editorId, tagName, count }) => (
              <button
                key={`click-${editorId}`}
                type="button"
                data-testid={`interaction-clicked-${editorId}`}
                onClick={() => onSelectNode(editorId)}
                className={`w-full flex items-center justify-between p-1.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  selectedId === editorId
                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-zinc-400 font-mono">&lt;{tagName}&gt;</span>
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono truncate">#{editorId}</span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0 ml-1">
                  {count}×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Interactions */}
      {formEntries.length > 0 && (
        <div data-testid="interaction-form-interactions" className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
            <FormInput className="w-3 h-3 text-amber-500" />
            <span>Form Interactions ({formEntries.length})</span>
          </div>
          <div className="space-y-1">
            {formEntries.map(({ id, focusCount, changeCount, fieldType }) => (
              <button
                key={`form-${id}`}
                type="button"
                onClick={() => onSelectNode(id)}
                className={`w-full flex items-center justify-between p-1.5 rounded text-[11px] border transition-colors cursor-pointer ${
                  selectedId === id
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {fieldType && (
                    <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">
                      {fieldType}
                    </span>
                  )}
                  <span className="text-zinc-600 dark:text-zinc-400 font-mono truncate">#{id}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 shrink-0 ml-1">
                  <span>{focusCount} focus</span>
                  <span>·</span>
                  <span>{changeCount} change</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Zero Interaction Elements (Collapsible) */}
      {summary.elementsWithNoInteraction.length > 0 && (
        <div data-testid="interaction-zero-elements" className="space-y-1">
          <button
            type="button"
            onClick={() => setShowZeroInteraction(!showZeroInteraction)}
            className="w-full flex items-center justify-between text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer py-1 transition-colors"
          >
            <span className="font-medium">
              Elements with no interaction ({summary.elementsWithNoInteraction.length})
            </span>
            {showZeroInteraction ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showZeroInteraction && (
            <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-2">
              {summary.elementsWithNoInteraction.slice(0, 50).map((id) => (
                <button
                  key={`zero-${id}`}
                  type="button"
                  onClick={() => onSelectNode(id)}
                  className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors truncate"
                >
                  #{id}
                </button>
              ))}
              {summary.elementsWithNoInteraction.length > 50 && (
                <p className="text-[10px] text-zinc-400 text-center pt-1">
                  +{summary.elementsWithNoInteraction.length - 50} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
