"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AggregatedProductionEvidence } from "@/lib/production/schemas";
import {
  Globe,
  Sparkles,
  RefreshCw,
  MousePointer2,
  ArrowDown,
  Monitor,
  Tablet,
  Smartphone,
  AlertTriangle,
  ChevronRight,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ProductionEvidenceDashboardProps {
  projectId?: string;
  onSelectNode?: (id: string | null) => void;
  selectedId?: string | null;
  onCreateOptimizationFromLiveEvidence?: (evidence: AggregatedProductionEvidence) => void;
  isCreatingOptimization?: boolean;
}

export function ProductionEvidenceDashboard({
  projectId = "proj_default",
  onSelectNode,
  selectedId,
  onCreateOptimizationFromLiveEvidence,
  isCreatingOptimization = false,
}: ProductionEvidenceDashboardProps) {
  const [evidenceList, setEvidenceList] = useState<AggregatedProductionEvidence[]>([]);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/production/evidence?projectId=${encodeURIComponent(projectId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch evidence (${res.status})`);
      }
      const data = await res.json();
      setEvidenceList(data.evidence || []);

      const versions: string[] = Array.from(
        new Set((data.evidence || []).map((e: AggregatedProductionEvidence) => e.versionId))
      );
      setAvailableVersions(versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading live evidence.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    const fetchAsync = async () => {
      try {
        const url = `/api/production/evidence?projectId=${encodeURIComponent(projectId)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;
        setEvidenceList(data.evidence || []);
        const versions: string[] = Array.from(
          new Set((data.evidence || []).map((e: AggregatedProductionEvidence) => e.versionId))
        );
        setAvailableVersions(versions);
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : "Error loading live evidence.");
      }
    };
    fetchAsync();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  // Combined or filtered evidence based on version selection
  const activeEvidence = useMemo<AggregatedProductionEvidence | null>(() => {
    if (evidenceList.length === 0) return null;

    if (selectedVersionFilter !== "all") {
      return evidenceList.find((e) => e.versionId === selectedVersionFilter) || null;
    }

    // Aggregate all versions together when "all" is selected
    const combined: AggregatedProductionEvidence = {
      projectId,
      pageId: evidenceList[0].pageId,
      versionId: "all",
      totalSessions: 0,
      viewportDistribution: { desktop: 0, tablet: 0, mobile: 0 },
      durationBuckets: { "<15s": 0, "15-30s": 0, "30-60s": 0, "1-3m": 0, ">3m": 0 },
      scrollDepthDistribution: { reached25: 0, reached50: 0, reached75: 0, reached100: 0 },
      ctaClickCounts: {},
      elementClickCounts: {},
      mostClickedElements: [],
      lowInteractionImportantElements: [],
      firstSeenAt: evidenceList[0].firstSeenAt,
      lastSeenAt: evidenceList[0].lastSeenAt,
    };

    for (const item of evidenceList) {
      combined.totalSessions += item.totalSessions;
      combined.viewportDistribution.desktop += item.viewportDistribution.desktop || 0;
      combined.viewportDistribution.tablet += item.viewportDistribution.tablet || 0;
      combined.viewportDistribution.mobile += item.viewportDistribution.mobile || 0;

      for (const [k, v] of Object.entries(item.durationBuckets || {})) {
        const bucketKey = k as keyof typeof combined.durationBuckets;
        combined.durationBuckets[bucketKey] = (combined.durationBuckets[bucketKey] || 0) + v;
      }

      combined.scrollDepthDistribution.reached25 += item.scrollDepthDistribution.reached25 || 0;
      combined.scrollDepthDistribution.reached50 += item.scrollDepthDistribution.reached50 || 0;
      combined.scrollDepthDistribution.reached75 += item.scrollDepthDistribution.reached75 || 0;
      combined.scrollDepthDistribution.reached100 += item.scrollDepthDistribution.reached100 || 0;

      for (const [id, count] of Object.entries(item.ctaClickCounts || {})) {
        combined.ctaClickCounts[id] = (combined.ctaClickCounts[id] || 0) + count;
      }

      for (const [id, count] of Object.entries(item.elementClickCounts || {})) {
        combined.elementClickCounts[id] = (combined.elementClickCounts[id] || 0) + count;
      }

      for (const low of item.lowInteractionImportantElements || []) {
        if (!combined.lowInteractionImportantElements.some((e) => e.editorId === low.editorId)) {
          combined.lowInteractionImportantElements.push(low);
        }
      }
    }

    combined.mostClickedElements = Object.entries(combined.elementClickCounts)
      .map(([editorId, count]) => ({ editorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return combined;
  }, [evidenceList, selectedVersionFilter, projectId]);

  const ctaEntries = useMemo(() => {
    if (!activeEvidence) return [];
    return Object.entries(activeEvidence.ctaClickCounts || {})
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [activeEvidence]);

  const scrollPercents = useMemo(() => {
    if (!activeEvidence || activeEvidence.totalSessions === 0) {
      return { p25: 0, p50: 0, p75: 0, p100: 0 };
    }
    const total = activeEvidence.totalSessions;
    return {
      p25: Math.round((activeEvidence.scrollDepthDistribution.reached25 / total) * 100),
      p50: Math.round((activeEvidence.scrollDepthDistribution.reached50 / total) * 100),
      p75: Math.round((activeEvidence.scrollDepthDistribution.reached75 / total) * 100),
      p100: Math.round((activeEvidence.scrollDepthDistribution.reached100 / total) * 100),
    };
  }, [activeEvidence]);

  return (
    <div
      data-testid="production-evidence-dashboard"
      className="p-3.5 rounded-xl bg-gradient-to-b from-blue-50/40 via-white to-zinc-50/50 dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-950 border border-blue-200/60 dark:border-blue-900/50 space-y-3 shadow-xs"
    >
      {/* Header with Live Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Production Evidence</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className="text-[10px] text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800"
          >
            Live Users
          </Badge>
          <button
            type="button"
            onClick={fetchEvidence}
            disabled={isLoading}
            title="Refresh Production Evidence"
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Version Filter Dropdown */}
      {availableVersions.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <label className="text-zinc-500 shrink-0 font-medium">Filter Version:</label>
          <select
            value={selectedVersionFilter}
            onChange={(e) => setSelectedVersionFilter(e.target.value)}
            data-testid="production-version-filter"
            className="w-full px-2 py-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Document Versions</option>
            {availableVersions.map((ver) => (
              <option key={ver} value={ver}>
                {ver}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Main Evidence Visualizations */}
      {activeEvidence && activeEvidence.totalSessions > 0 ? (
        <div className="space-y-3">
          {/* Total Sessions & Viewport Distribution */}
          <div
            data-testid="production-total-sessions"
            className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Total Validated Sessions:</span>
              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                {activeEvidence.totalSessions}
              </span>
            </div>

            {/* Viewport Breakdown */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-1">
                <Monitor className="w-3 h-3 text-zinc-400" />
                <span>{activeEvidence.viewportDistribution.desktop}</span>
              </div>
              <div className="flex items-center gap-1">
                <Tablet className="w-3 h-3 text-zinc-400" />
                <span>{activeEvidence.viewportDistribution.tablet}</span>
              </div>
              <div className="flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-zinc-400" />
                <span>{activeEvidence.viewportDistribution.mobile}</span>
              </div>
            </div>
          </div>

          {/* Scroll Depth Distribution */}
          <div data-testid="production-scroll-depth" className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-semibold">
                <ArrowDown className="w-3 h-3 text-blue-500" />
                <span>Scroll Depth Distribution</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {scrollPercents.p100}% reached end
              </span>
            </div>

            {/* Visual Threshold Bars */}
            <div className="grid grid-cols-4 gap-1">
              {([25, 50, 75, 100] as const).map((t) => {
                const key = `p${t}` as keyof typeof scrollPercents;
                const pct = scrollPercents[key];
                return (
                  <div
                    key={t}
                    className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center space-y-1"
                  >
                    <div className="text-[9px] font-mono text-zinc-400">{t}%</div>
                    <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA Click Counts */}
          {ctaEntries.length > 0 && (
            <div data-testid="production-cta-clicks" className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
                <MousePointer2 className="w-3 h-3 text-emerald-500" />
                <span>CTA Clicks ({ctaEntries.length})</span>
              </div>
              <div className="space-y-1">
                {ctaEntries.map(({ id, count }) => (
                  <button
                    key={`prod-cta-${id}`}
                    type="button"
                    onClick={() => onSelectNode?.(id)}
                    className={`w-full flex items-center justify-between p-1.5 rounded text-[11px] border transition-colors cursor-pointer ${
                      selectedId === id
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate">
                      #{id}
                    </span>
                    <Badge variant="success" className="text-[9px] ml-1 shrink-0">
                      {count} click{count !== 1 ? "s" : ""}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Most Clicked Elements */}
          {activeEvidence.mostClickedElements.length > 0 && (
            <div data-testid="production-most-clicked" className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
                <MousePointer2 className="w-3 h-3 text-blue-500" />
                <span>Most Clicked Elements</span>
              </div>
              <div className="space-y-1">
                {activeEvidence.mostClickedElements.slice(0, 5).map(({ editorId, count }) => (
                  <button
                    key={`prod-click-${editorId}`}
                    type="button"
                    onClick={() => onSelectNode?.(editorId)}
                    className={`w-full flex items-center justify-between p-1.5 rounded text-[11px] border transition-colors cursor-pointer ${
                      selectedId === editorId
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <span className="text-zinc-600 dark:text-zinc-400 font-mono truncate">
                      #{editorId}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0 ml-1">
                      {count}×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Low-Interaction Important Elements */}
          {activeEvidence.lowInteractionImportantElements.length > 0 && (
            <div data-testid="production-low-interaction" className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                <span>Low-Interaction Elements ({activeEvidence.lowInteractionImportantElements.length})</span>
              </div>
              <div className="space-y-1">
                {activeEvidence.lowInteractionImportantElements.map(({ editorId, reason }) => (
                  <button
                    key={`prod-low-${editorId}`}
                    type="button"
                    onClick={() => onSelectNode?.(editorId)}
                    className="w-full text-left p-1.5 rounded text-[10px] bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-0.5 cursor-pointer hover:border-amber-400 transition-colors"
                  >
                    <div className="font-mono font-bold text-amber-800 dark:text-amber-300">
                      #{editorId}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-[10px] leading-tight">
                      {reason}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action: Create Optimization from Live Evidence */}
          {onCreateOptimizationFromLiveEvidence && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onCreateOptimizationFromLiveEvidence(activeEvidence)}
              disabled={isCreatingOptimization}
              data-testid="btn-create-live-optimization"
              className="w-full gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs font-semibold text-xs py-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create optimization from live evidence</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </Button>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            No Live Evidence Yet
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[200px] mx-auto">
            Publish your landing page to start collecting privacy-safe scroll, CTA, and viewport evidence from real visitors.
          </p>
        </div>
      )}
    </div>
  );
}
