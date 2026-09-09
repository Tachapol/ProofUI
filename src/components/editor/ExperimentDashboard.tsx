"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  Trophy,
  RefreshCw,
  Clock,
  ShieldCheck,
  Sparkles,
  Plus,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UXExperiment } from "@/lib/experiment/schemas";
import { ExperimentEvaluationResult } from "@/lib/experiment/decisioning";

interface ExperimentDashboardProps {
  onWorkflowChange?: () => void;
  projectId: string;
  onOpenCreateExperiment?: () => void;
  onApplyEvidenceToUXAnalyzer?: (evaluation: ExperimentEvaluationResult) => void;
  isApplyingEvidence?: boolean;
  refreshTrigger?: number;
  lastCreatedExperimentId?: string;
}

export function ExperimentDashboard({
  projectId,
  onOpenCreateExperiment,
  onApplyEvidenceToUXAnalyzer,
  isApplyingEvidence = false,
  refreshTrigger,
  lastCreatedExperimentId,
  onWorkflowChange,
}: ExperimentDashboardProps) {
  const [experiments, setExperiments] = useState<UXExperiment[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [rawEvaluation, setRawEvaluation] = useState<ExperimentEvaluationResult | null>(null);
  const evaluation = rawEvaluation?.experimentId === selectedExperimentId ? rawEvaluation : null;
  const [isLoading, setIsLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Promote confirmation modal state
  const [confirmPromoteVersionId, setConfirmPromoteVersionId] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteSuccessMessage, setPromoteSuccessMessage] = useState<string | null>(null);

  // Manual refresh handler for evaluation
  const refreshEvaluation = useCallback(async (expId: string) => {
    try {
      setIsRefreshing(true);
      setErrorMessage(null);
      const res = await fetch(`/api/experiment/${encodeURIComponent(expId)}`);
      if (!res.ok) throw new Error("Failed to load experiment evaluation.");
      const data = await res.json();
      setRawEvaluation(data.evaluation || null);
      onWorkflowChange?.();
    } catch (err) {
      setRawEvaluation(null);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load experiment evaluation.");
    } finally {
      setIsRefreshing(false);
    }
  }, [onWorkflowChange]);

  // Fetch experiments list on project/trigger change
  useEffect(() => {
    let ignore = false;
    async function fetchExperiments() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/experiment?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) throw new Error("Failed to load experiments. Retry to verify status.");
        const data = await res.json();
        if (ignore) return;
        const list: UXExperiment[] = data.experiments || [];
        setExperiments(list);
        if (list.length > 0) {
          setSelectedExperimentId((prev) => {
            if (lastCreatedExperimentId) return lastCreatedExperimentId;
            if (prev && list.some((e) => e.id === prev)) return prev;
            return list[0].id;
          });
        } else {
          setSelectedExperimentId(null);
        }
      } catch (err) {
        if (!ignore) setErrorMessage(err instanceof Error ? err.message : "Failed to load experiments.");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    fetchExperiments();
    return () => {
      ignore = true;
    };
  }, [projectId, refreshTrigger, lastCreatedExperimentId, retry]);

  // Fetch evaluation when selected experiment changes
  useEffect(() => {
    if (!selectedExperimentId) return;
    let ignore = false;
    async function fetchEval() {
      setIsRefreshing(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/experiment/${encodeURIComponent(selectedExperimentId!)}`);
        if (!res.ok) throw new Error("Failed to load experiment evaluation. Refresh to retry.");
        const data = await res.json();
        if (!ignore) {
          setRawEvaluation(data.evaluation || null);
        }
      } catch (err) {
        if (!ignore) { setRawEvaluation(null); setErrorMessage(err instanceof Error ? err.message : "Failed to load evaluation."); }
      } finally {
        if (!ignore) setIsRefreshing(false);
      }
    }
    fetchEval();
    return () => {
      ignore = true;
    };
  }, [selectedExperimentId]);

  const activeExperiment = experiments.find((e) => e.id === selectedExperimentId);

  // Promote winner handler with explicit confirmation
  const handleConfirmPromote = async () => {
    if (!selectedExperimentId || !confirmPromoteVersionId) return;

    try {
      setIsPromoting(true);
      setErrorMessage(null);
      setPromoteSuccessMessage(null);

      const res = await fetch(`/api/experiment/${encodeURIComponent(selectedExperimentId)}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          versionId: confirmPromoteVersionId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to promote winner.");
      }

      setPromoteSuccessMessage(data.message || `Promoted version '${confirmPromoteVersionId}' to active production.`);
      setConfirmPromoteVersionId(null);
      // Immediately reflect concluded status locally and refresh
      setExperiments((prev) =>
        prev.map((e) =>
          e.id === selectedExperimentId ? { ...e, status: "concluded" as const } : e
        )
      );
      try {
        const listRes = await fetch(`/api/experiment?projectId=${encodeURIComponent(projectId)}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          if (listData.experiments) setExperiments(listData.experiments);
        }
      } catch {
        // Ignored
      }
      // Reload evaluation
      await refreshEvaluation(selectedExperimentId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to promote winner.");
    } finally {
      setIsPromoting(false);
    }
  };

  if (isLoading) return <p role="status" className="p-4">Loading experiments…</p>;
  if (experiments.length === 0 && errorMessage) return <div role="alert" className="p-4">{errorMessage}<Button onClick={() => setRetry(n => n + 1)}>Retry experiments</Button></div>;
  if (experiments.length === 0) {
    return (
      <div data-testid="experiment-empty-state" className="p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <FlaskConical className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-foreground">No UX Experiments Yet</h3>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
            Compare two published versions using a fixed production sample. Results may be inconclusive.
          </p>
        </div>
        {onOpenCreateExperiment && (
          <Button
            type="button"
            size="sm"
            data-testid="btn-create-experiment-from-empty"
            onClick={onOpenCreateExperiment}
            className="text-xs gap-1.5 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Experiment</span>
          </Button>
        )}
      </div>
    );
  }

  const totalSessions = evaluation ? evaluation.control.sessions + evaluation.variant.sessions : 0;
  const minRequired = evaluation ? evaluation.minSampleSize : 20;
  const sampleProgressPct = Math.min(100, Math.round((totalSessions / Math.max(1, minRequired)) * 100));

  return (
    <div data-testid="experiment-dashboard" className="space-y-4 text-xs">
      {isRefreshing && <p role="status">Loading evaluation…</p>}
      <p className="text-muted-foreground">Decision rule: two-sided Fisher exact test, p ≤ {evaluation ? Math.min(0.05, 1 - evaluation.confidenceThreshold).toFixed(3) : "0.05"}, after the first {evaluation?.minSampleSizePerVariant ?? "predeclared number of"} sessions per arm. The sample then freezes. A p-value is not the probability a winner is correct. Preview/test events are excluded.</p>
      {activeExperiment && <a className="underline" href={`/api/production/experiment/${activeExperiment.id}`} target="_blank" rel="noreferrer">Open experiment traffic URL</a>}
      {/* Top Controls: Selector & Refresh & New Experiment */}
      <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-lg border border-border">
        <div className="flex-1 min-w-0">
          <select
            data-testid="select-experiment"
            value={selectedExperimentId || ""}
            onChange={(e) => setSelectedExperimentId(e.target.value)}
            className="w-full h-7 px-2 border border-input rounded text-xs bg-background truncate font-medium"
          >
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name} ({exp.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="btn-refresh-experiment"
            onClick={() => selectedExperimentId && refreshEvaluation(selectedExperimentId)}
            disabled={isRefreshing}
            className="h-7 w-7 p-0"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          </Button>

          {onOpenCreateExperiment && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="btn-new-experiment"
              onClick={onOpenCreateExperiment}
              className="h-7 px-2 text-[11px] gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-red-700 dark:text-red-300 flex items-start gap-2 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {promoteSuccessMessage && (
        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg text-emerald-700 dark:text-emerald-300 flex items-start gap-2 text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{promoteSuccessMessage}</span>
        </div>
      )}

      {/* Experiment Details Header */}
      {activeExperiment && (
        <div className="p-3 bg-card border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs">{activeExperiment.name}</span>
            <Badge
              variant={activeExperiment.status === "running" ? "default" : "secondary"}
              data-testid="badge-experiment-status"
              className="text-[10px] uppercase font-bold"
            >
              {activeExperiment.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <div>
              <span className="text-muted-foreground/70">Primary Goal: </span>
              <span className="font-medium text-foreground">
                {activeExperiment.goal.type === "cta_click"
                  ? `CTA Clicks ${activeExperiment.goal.targetCtaId ? `(${activeExperiment.goal.targetCtaId})` : "(Any CTA)"}`
                  : `Scroll Depth (${activeExperiment.goal.thresholdScroll || 100}%)`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/70">Traffic Split: </span>
              <span className="font-medium text-foreground">
                {activeExperiment.trafficSplit}% / {100 - activeExperiment.trafficSplit}%
              </span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Started: {new Date(activeExperiment.startedAt).toLocaleDateString()}</span>
            {activeExperiment.endedAt && (
              <span>• Concluded: {new Date(activeExperiment.endedAt).toLocaleDateString()}</span>
            )}
            {activeExperiment.promotedVersionId && (
              <span className="text-emerald-600 font-medium">
                • Active Winner: {activeExperiment.promotedVersionId}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sample Size Progress Bar */}
      {evaluation && (
        <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Sample Size Progress</span>
            <span className="font-semibold text-foreground" data-testid="sample-size-counter">
              {totalSessions} / {minRequired} sessions ({sampleProgressPct}%)
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${sampleProgressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
            <span>Control: {evaluation.control.sessions} sessions</span>
            <span>Variant: {evaluation.variant.sessions} sessions</span>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison: Control vs Variant */}
      {evaluation && (
        <div className="grid grid-cols-2 gap-2.5">
          {/* Control Card */}
          <div
            data-testid="variant-card-control"
            className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
              evaluation.winner === "control"
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30"
                : "bg-card border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                Control (A)
              </span>
              {evaluation.winner === "control" && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 py-0">
                  <Trophy className="w-2.5 h-2.5" /> Winner
                </Badge>
              )}
            </div>

            <div className="font-mono text-[11px] text-foreground font-semibold truncate" title={evaluation.control.versionId}>
              {evaluation.control.versionId}
            </div>

            <div className="pt-1.5 border-t border-border/50 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sessions:</span>
                <span className="font-medium">{evaluation.control.sessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CTA Clicks:</span>
                <span className="font-medium">{evaluation.control.ctaClicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scroll 100%:</span>
                <span className="font-medium">{evaluation.control.scroll100Count}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/40 font-semibold">
                <span className="text-foreground">Conversion Rate:</span>
                <span className="text-primary font-mono" data-testid="control-conversion-rate">
                  {(evaluation.control.conversionRate * 100).toFixed(1)}% ({evaluation.control.conversions}/{evaluation.control.sessions} sessions)
                </span>
              </div>
            </div>
          </div>

          {/* Variant Card */}
          <div
            data-testid="variant-card-variant"
            className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
              evaluation.winner === "variant"
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30"
                : "bg-card border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                Variant (B)
              </span>
              {evaluation.winner === "variant" && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 gap-1 py-0">
                  <Trophy className="w-2.5 h-2.5" /> Winner
                </Badge>
              )}
            </div>

            <div className="font-mono text-[11px] text-foreground font-semibold truncate" title={evaluation.variant.versionId}>
              {evaluation.variant.versionId}
            </div>

            <div className="pt-1.5 border-t border-border/50 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sessions:</span>
                <span className="font-medium">{evaluation.variant.sessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">CTA Clicks:</span>
                <span className="font-medium">{evaluation.variant.ctaClicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scroll 100%:</span>
                <span className="font-medium">{evaluation.variant.scroll100Count}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/40 font-semibold">
                <span className="text-foreground">Conversion Rate:</span>
                <span className="text-primary font-mono" data-testid="variant-conversion-rate">
                  {(evaluation.variant.conversionRate * 100).toFixed(1)}% ({evaluation.variant.conversions}/{evaluation.variant.sessions} sessions)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decisioning State Banner */}
      {evaluation && (
        <div data-testid="experiment-decisioning-banner" className="space-y-3">
          {!evaluation.hasSufficientData ? (
            // Insufficient Data State
            <div
              data-testid="state-insufficient-data"
              className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg space-y-1.5"
            >
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Insufficient Data for Decisioning</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                {evaluation.recommendationSummary}
              </p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80">
                ProofUI rules prohibit declaring a winner before evidence thresholds are reached.
              </p>
            </div>
          ) : evaluation.winner === "inconclusive" ? (
            // Inconclusive State
            <div
              data-testid="state-inconclusive"
              className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-lg space-y-1.5"
            >
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold text-xs">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Inconclusive Results</span>
              </div>
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                {evaluation.recommendationSummary}
              </p>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-500/80">
                Uncertainty: two-sided p={evaluation.pValue.toPrecision(3)}
              </p>
            </div>
          ) : (
            // Winner Recommended Card
            <div
              data-testid="state-winner-recommended"
              className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Recommended Winner: {evaluation.winner.toUpperCase()}</span>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-[10px] py-0.5">
                  p={evaluation.pValue.toPrecision(3)}
                </Badge>
              </div>

              <p className="text-[11px] text-emerald-800 dark:text-emerald-300" data-testid="winner-recommendation-summary">
                {evaluation.recommendationSummary}
              </p>

              {/* Promote Winner Button */}
              {activeExperiment && activeExperiment.status === "running" && evaluation.recommendedWinner && (
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-900/60 flex items-center justify-end">
                  <Button
                    type="button"
                    size="sm"
                    data-testid="btn-promote-winner"
                    disabled={isRefreshing || !!errorMessage}
                    onClick={() => setConfirmPromoteVersionId(evaluation.recommendedWinner)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8 shadow-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Promote Winner to Live</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Integration: Use Experiment Evidence in UX Analyzer */}
      {evaluation && onApplyEvidenceToUXAnalyzer && (
        <div className="p-3 bg-muted/20 border border-border rounded-lg flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-foreground">Apply to UX Analyzer</div>
            <div className="text-[11px] text-muted-foreground">
              Feed A/B conversion findings directly into optimization recommendations.
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="btn-use-experiment-evidence"
            onClick={() => onApplyEvidenceToUXAnalyzer(evaluation)}
            disabled={isApplyingEvidence || isRefreshing || !!errorMessage}
            className="text-xs gap-1.5 h-8 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Use Evidence</span>
          </Button>
        </div>
      )}

      {/* Explicit Confirmation Modal for Promote Winner */}
      {confirmPromoteVersionId && (
        <div
          data-testid="modal-confirm-promote"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-popover border border-border rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-foreground font-semibold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Confirm Production Promotion</span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to promote <strong className="text-foreground">{confirmPromoteVersionId}</strong> as the active published version for this page?
            </p>

            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-md text-[11px] text-amber-800 dark:text-amber-300">
              Per ProofUI safety rules, this action requires explicit confirmation and will conclude the A/B test.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmPromoteVersionId(null)}
                disabled={isPromoting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="btn-confirm-promote-winner"
                onClick={handleConfirmPromote}
                disabled={isPromoting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isPromoting ? "Promoting..." : "Confirm & Promote"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
