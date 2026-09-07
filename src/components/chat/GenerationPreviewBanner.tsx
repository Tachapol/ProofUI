"use client";

import React from "react";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { GenerationCandidate } from "@/lib/generation/schemas";
import { Button } from "@/components/ui/button";

interface GenerationPreviewBannerProps {
  candidate: GenerationCandidate;
  isComparingOriginal: boolean;
  onToggleCompare: () => void;
  onApply: (candidate: GenerationCandidate) => void;
  onExitPreview: () => void;
}

export function GenerationPreviewBanner({
  candidate,
  isComparingOriginal,
  onToggleCompare,
  onApply,
  onExitPreview,
}: GenerationPreviewBannerProps) {
  const isStale = candidate.status === "stale";

  return (
    <div
      data-testid="generation-preview-banner"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-full bg-background/95 border border-border shadow-lg backdrop-blur-md text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        <span className="font-semibold text-foreground">
          {isComparingOriginal ? "Comparing: Current Document" : "Generated Preview (Uncommitted)"}
        </span>
        {candidate.optimizationComparison && (
          <span
            data-testid="banner-ux-score-delta"
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              candidate.optimizationComparison.scoreDelta > 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20"
            }`}
          >
            {candidate.optimizationComparison.scoreDelta > 0
              ? `UX score: ${candidate.optimizationComparison.baselineScore} → ${candidate.optimizationComparison.candidateScore} (+${candidate.optimizationComparison.scoreDelta})`
              : candidate.optimizationComparison.scoreDelta === 0
              ? `UX score: ${candidate.optimizationComparison.baselineScore} (±0)`
              : `UX score: ${candidate.optimizationComparison.baselineScore} → ${candidate.optimizationComparison.candidateScore} (${candidate.optimizationComparison.scoreDelta})`}
          </span>
        )}
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggleCompare}
          data-testid="btn-banner-compare-candidate"
          className="h-7 px-2.5 text-xs gap-1"
        >
          <ArrowRightLeft className="w-3 h-3" />
          <span>{isComparingOriginal ? "Show Generated" : "Show Current"}</span>
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isStale}
          onClick={() => onApply(candidate)}
          data-testid="btn-banner-apply-candidate"
          className="h-7 px-2.5 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-3 h-3" />
          <span>Apply</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExitPreview}
          data-testid="btn-banner-exit-preview"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Exit preview"
          aria-label="Exit preview"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
