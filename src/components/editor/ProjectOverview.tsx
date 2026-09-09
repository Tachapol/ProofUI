"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentVersion, GenerationCandidate } from "@/lib/generation/schemas";
import { ReviewState, evidenceIsStale, nextReviewAction } from "@/lib/review/workflow";
import { PublishedMetadata, AggregatedProductionEvidence } from "@/lib/production/schemas";
import { UXExperiment } from "@/lib/experiment/schemas";
import { ExperimentEvaluationResult } from "@/lib/experiment/decisioning";

interface OverviewData {
  fetchedAt: string;
  activeVersionId: string | null;
  published: PublishedMetadata[];
  evidence: AggregatedProductionEvidence[];
  experiments: { experiment: UXExperiment; evaluation: ExperimentEvaluationResult | null }[];
}
const labels = { generate: "Generate a page", analyze: "Analyze current version", optimize: "Select findings to optimize", compare: "Compare candidate", publish: "Publish applied version", experiment: "Create experiment", review: "Review experiment" };

export function ProjectOverview({ projectId, pageId, versions, revision, review, candidate, previewEvents, refreshTrigger, onAction }: {
  projectId: string; pageId: string; versions: DocumentVersion[]; revision: number;
  review: ReviewState; candidate: GenerationCandidate | null; previewEvents: number;
  refreshTrigger: number;
  onAction: (action: keyof typeof labels, experimentId?: string) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function fetchOverview() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/review?projectId=${encodeURIComponent(projectId)}&pageId=${encodeURIComponent(pageId)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Review request failed (${response.status}). Retry to verify live state.`);
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Review request failed.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void fetchOverview();
    return () => controller.abort();
  }, [projectId, pageId, refresh, refreshTrigger]);

  const current = versions.find(v => v.revision === revision);
  const latestDecision = review.decisions.findLast(d => d.appliedVersionId === current?.id && d.analysis);
  const currentExperiment = data?.experiments.findLast(e => e.experiment.controlVersionId === current?.id || e.experiment.variantVersionId === current?.id);
  const staleAnalysis = !!review.analysis && (review.analysis.documentRevision !== revision || evidenceIsStale(review.analysis.timestamp));
  const isCurrentActive = !!current && current.id === data?.activeVersionId;
  const isCurrentPublished = !!current && (data?.published.some(p => p.versionId === current.id) ?? false);
  const currentEvidence = current ? (data?.evidence.filter(e => e.versionId === current.id) ?? []) : [];
  const currentSessions = currentEvidence.reduce((n, e) => n + e.totalSessions, 0);
  const staleCurrentEvidence = !!error || currentEvidence.some(e => e.totalSessions > 0 && evidenceIsStale(e.lastSeenAt));
  const action = nextReviewAction({
    generated: versions.some(v => v.source !== "initial"), candidate: !!candidate,
    staleCandidate: candidate?.status === "stale", analyzed: !!review.analysis, staleAnalysis,
    unpublishedApplied: !!latestDecision && !data?.published.some(v => v.versionId === current?.id),
    publishedCount: data?.published.length ?? 0, experiment: !!currentExperiment,
  });

  return <section data-testid="project-overview" suppressHydrationWarning className="shrink-0 border-b border-border bg-background px-4 py-2 text-xs space-y-2">
    <div className="flex items-center justify-between gap-3" suppressHydrationWarning>
      <div suppressHydrationWarning><strong>Project overview</strong> · Current: {current ? `${current.id} (Rev ${revision})` : `Unversioned edits (Rev ${revision})`}</div>
      <Button size="sm" data-testid="next-action" disabled={loading || !!error} onClick={() => onAction(action, currentExperiment?.experiment.id)}>Next action: {labels[action]}</Button>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground" aria-live="polite">
      <span data-testid="overview-analysis">{review.analysis ? `Heuristic checks: ${review.analysis.score}/100 · ${staleAnalysis ? "Stale — analyze again" : `${review.analysis.findings.length} findings`}` : "No analysis yet"}</span>
      <span>Preview/test: {previewEvents} local events · excluded from production</span>
      <span data-testid="overview-live">
        {loading
          ? "Loading live evidence…"
          : error
          ? "Live evidence unavailable (stale)"
          : !data?.activeVersionId
          ? "Not published"
          : isCurrentActive
          ? `Production: ${data.activeVersionId} · ${currentSessions} sessions${staleCurrentEvidence ? " · Stale (older than 24h)" : currentSessions === 0 ? " · Insufficient data" : ""}`
          : isCurrentPublished
          ? `Production: ${data.activeVersionId} active · Current ${current!.id} inactive (${currentSessions} sessions)`
          : `Production: ${data.activeVersionId} active · Current version not published`}
      </span>
      <span data-testid="overview-experiment">{loading ? "Loading experiments…" : error ? "Experiment status unavailable" : currentExperiment ? `Experiment: ${currentExperiment.experiment.status} · ${currentExperiment.evaluation?.winner.replaceAll("_", " ") ?? "inconclusive"}` : "No experiment for current version"}</span>
    </div>
    {error && <p role="alert">{error} Last successful snapshot is not current evidence.</p>}
    <details data-testid="decision-history" className="max-h-64 overflow-auto">
      <summary className="cursor-pointer">Decision history · {review.decisions.length} candidates</summary>
      <p className="my-2 text-muted-foreground">Automated scores are heuristic checks, not proven UX improvement. Production conversion uses converted sessions / admitted sessions; Preview/test events are separate. Review one fixed sample before any explicit promotion.</p>
      <Button size="sm" variant="outline" data-testid="refresh-review" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? "Loading…" : error ? "Retry review" : "Refresh live review"}</Button>
      {!review.decisions.length && <p className="py-2">No decisions yet. Generate a page or analyze the current document.</p>}
      {review.decisions.map(decision => {
        const item = review.candidates.find(c => c.result.id === decision.candidateId);
        const published = data?.published.find(v => v.versionId === decision.appliedVersionId);
        const experiments = data?.experiments.filter(e => e.experiment.controlVersionId === decision.appliedVersionId || e.experiment.variantVersionId === decision.appliedVersionId) ?? [];
        return <article key={decision.candidateId} data-testid="decision-entry" className="my-2 border border-border rounded p-2 space-y-1 break-words">
          <p>Baseline {decision.baselineVersionId} → {decision.analysis ? `Analysis ${decision.analysis.id} (Rev ${decision.analysis.documentRevision})` : "Generation (no findings selected)"}</p>
          {decision.analysis && <p>Findings: {decision.analysis.findings.filter(f => decision.selectedFindingIds.includes(f.id)).map(f => `${f.id}: ${f.title}`).join("; ") || "None selected"}</p>}
          <p>Candidate {decision.candidateId}: {item?.result.summary} · <strong>{item?.status ?? "unavailable"}</strong>{item?.status === "ready" && item.result.basedOnRevision !== revision ? " · stale" : ""}</p>
          {item?.optimizationComparison && <p>Heuristic comparison: {item.optimizationComparison.baselineScore} → {item.optimizationComparison.candidateScore}; not a measured conversion improvement.</p>}
          <p>Applied version: {decision.appliedVersionId ?? "Not applied"} → {published ? <a className="underline" href={`/api/production/view/${projectId}/${published.versionId}`} target="_blank" rel="noreferrer">Published {published.versionId}</a> : error ? "Publication unverified" : "Not published"}</p>
          {experiments.map(({ experiment, evaluation }) => <div key={experiment.id}>
            <button className="underline" onClick={() => onAction("review", experiment.id)}>Experiment {experiment.name} ({experiment.id}) · {experiment.status}</button>
            {evaluation ? <p>Result: {evaluation.winner.replaceAll("_", " ")} · Control {evaluation.control.conversions}/{evaluation.control.sessions}; variant {evaluation.variant.conversions}/{evaluation.variant.sessions} converted sessions · two-sided p={evaluation.pValue.toPrecision(3)} · {evaluation.recommendationSummary}</p> : <p>Inconclusive — evaluation unavailable.</p>}
            <p>{experiment.promotedVersionId ? `Explicitly promoted: ${experiment.promotedVersionId}` : "No version promoted"}</p>
          </div>)}
        </article>;
      })}
    </details>
  </section>;
}
