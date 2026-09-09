"use client";

import React, { useState, useEffect } from "react";
import { FlaskConical, X, AlertCircle, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UXExperiment, CreateExperimentRequest } from "@/lib/experiment/schemas";
import { PublishedMetadata } from "@/lib/production/schemas";

interface CreateExperimentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  pageId?: string;
  onCreated?: (experiment: UXExperiment) => void;
  initialControlVersionId?: string;
  initialVariantVersionId?: string;
}

export function CreateExperimentDialog({
  isOpen,
  onClose,
  projectId,
  pageId = "page_landing",
  onCreated,
  initialControlVersionId,
  initialVariantVersionId,
}: CreateExperimentDialogProps) {
  const [publishedVersions, setPublishedVersions] = useState<PublishedMetadata[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [name, setName] = useState("UX Variant Conversion Test");
  const [controlVersionId, setControlVersionId] = useState(initialControlVersionId || "");
  const [variantVersionId, setVariantVersionId] = useState(initialVariantVersionId || "");
  const [goalType, setGoalType] = useState<"cta_click" | "scroll_completion">("cta_click");
  const [targetCtaId, setTargetCtaId] = useState("");
  const [thresholdScroll, setThresholdScroll] = useState<25 | 50 | 75 | 100>(100);
  const [minSampleSize, setMinSampleSize] = useState(20);
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch published versions when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const loadAsync = async () => {
      setIsLoadingVersions(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/production/evidence?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) throw new Error("Failed to load published versions.");
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data.publishedVersions)) {
          const versions: PublishedMetadata[] = data.publishedVersions.filter((v: PublishedMetadata) => v.pageId === pageId);
          setPublishedVersions(versions);

          if (!controlVersionId && versions.length > 0) {
            setControlVersionId(versions[0].versionId);
          }
          if (!variantVersionId && versions.length > 1) {
            setVariantVersionId(versions[1].versionId);
          }
        }
      } catch {
        if (mounted) {
          setErrorMessage("Failed to load published versions.");
        }
      } finally {
        if (mounted) setIsLoadingVersions(false);
      }
    };

    loadAsync();

    return () => {
      mounted = false;
    };
  }, [isOpen, projectId, pageId, controlVersionId, variantVersionId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!controlVersionId) {
      setErrorMessage("Please select a Control version.");
      return;
    }
    if (!variantVersionId) {
      setErrorMessage("Please select a Variant version.");
      return;
    }
    if (controlVersionId === variantVersionId) {
      setErrorMessage("Control and Variant versions must be different.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateExperimentRequest = {
        projectId,
        pageId,
        name,
        controlVersionId,
        variantVersionId,
        goal: {
          type: goalType,
          targetCtaId: targetCtaId.trim() ? targetCtaId.trim() : undefined,
          thresholdScroll,
        },
        trafficSplit,
        minSampleSize,
        confidenceThreshold: 0.95,
      };

      const res = await fetch("/api/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create experiment.");
      }

      if (onCreated) {
        onCreated(data.experiment);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create experiment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-testid="create-experiment-dialog"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-popover border border-border rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Create UX A/B Experiment</h2>
              <p className="text-xs text-muted-foreground">Compare two published page versions with live production traffic</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div
              data-testid="experiment-error-alert"
              className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-red-700 dark:text-red-300 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Experiment Name */}
          <div className="space-y-1.5">
            <label htmlFor="exp-name" className="text-xs font-medium">Experiment Name</label>
            <Input
              id="exp-name"
              data-testid="input-experiment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hero CTA & Value Proposition Test"
              required
              className="h-8 text-xs"
            />
          </div>

          {/* Control & Variant Selection */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border rounded-lg">
            <div className="space-y-1.5">
              <label htmlFor="control-version" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center">
                <span>Control Version (A)</span>
                {isLoadingVersions && <RefreshCw className="w-2.5 h-2.5 animate-spin text-primary ml-1.5" />}
              </label>
              {publishedVersions.length > 0 ? (
                <select
                  id="control-version"
                  data-testid="select-control-version"
                  value={controlVersionId}
                  onChange={(e) => setControlVersionId(e.target.value)}
                  className="w-full h-8 px-2 border border-input rounded-md bg-background text-xs"
                >
                  {publishedVersions.map((v) => (
                    <option key={v.versionId} value={v.versionId}>
                      {v.versionId}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="control-version"
                  data-testid="input-control-version"
                  value={controlVersionId}
                  onChange={(e) => setControlVersionId(e.target.value)}
                  placeholder="e.g. ver_123"
                  className="h-8 text-xs"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="variant-version" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Variant Version (B)
              </label>
              {publishedVersions.length > 0 ? (
                <select
                  id="variant-version"
                  data-testid="select-variant-version"
                  value={variantVersionId}
                  onChange={(e) => setVariantVersionId(e.target.value)}
                  className="w-full h-8 px-2 border border-input rounded-md bg-background text-xs"
                >
                  {publishedVersions.map((v) => (
                    <option key={v.versionId} value={v.versionId}>
                      {v.versionId}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="variant-version"
                  data-testid="input-variant-version"
                  value={variantVersionId}
                  onChange={(e) => setVariantVersionId(e.target.value)}
                  placeholder="e.g. ver_456"
                  className="h-8 text-xs"
                />
              )}
            </div>
          </div>

          {/* Primary Optimization Metric */}
          <div className="space-y-2 p-3 bg-muted/20 border border-border rounded-lg">
            <label className="text-xs font-semibold">Primary Goal Metric</label>
            <p className="text-[11px] text-muted-foreground">
              Statistical decisioning will evaluate conversion lift specifically against this goal.
            </p>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                data-testid="goal-type-cta"
                onClick={() => setGoalType("cta_click")}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  goalType === "cta_click"
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border bg-background text-muted-foreground hover:border-border/80"
                }`}
              >
                <div className="font-semibold text-xs text-foreground">CTA Clicks</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Primary action button clicks</div>
              </button>

              <button
                type="button"
                data-testid="goal-type-scroll"
                onClick={() => setGoalType("scroll_completion")}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  goalType === "scroll_completion"
                    ? "border-primary bg-primary/10 text-foreground font-medium"
                    : "border-border bg-background text-muted-foreground hover:border-border/80"
                }`}
              >
                <div className="font-semibold text-xs text-foreground">Scroll Completion</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Reading to bottom of page</div>
              </button>
            </div>

            {goalType === "cta_click" && (
              <div className="mt-2 space-y-1">
                <label htmlFor="target-cta" className="text-[11px] text-muted-foreground">
                  Specific CTA Editor ID (Optional)
                </label>
                <Input
                  id="target-cta"
                  data-testid="input-target-cta-id"
                  value={targetCtaId}
                  onChange={(e) => setTargetCtaId(e.target.value)}
                  placeholder="Leave blank to count any CTA button click"
                  className="h-8 text-xs"
                />
              </div>
            )}

            {goalType === "scroll_completion" && (
              <div className="mt-2 space-y-1">
                <label htmlFor="threshold-scroll" className="text-[11px] text-muted-foreground">
                  Scroll Completion Threshold
                </label>
                <select
                  id="threshold-scroll"
                  data-testid="select-threshold-scroll"
                  value={thresholdScroll}
                  onChange={(e) => setThresholdScroll(Number(e.target.value) as 25 | 50 | 75 | 100)}
                  className="w-full h-8 px-2 border border-input rounded-md bg-background text-xs"
                >
                  <option value={100}>100% (Complete page scroll)</option>
                  <option value={75}>75% (Deep scroll)</option>
                  <option value={50}>50% (Midway)</option>
                  <option value={25}>25% (Initial scroll)</option>
                </select>
              </div>
            )}
          </div>

          {/* Sample Size & Confidence Threshold */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="sample-size" className="text-xs font-medium">Min Sample Size (Sessions)</label>
              <Input
                id="sample-size"
                data-testid="input-min-sample-size"
                type="number"
                min={4}
                max={10000}
                value={minSampleSize}
                onChange={(e) => setMinSampleSize(Math.max(4, parseInt(e.target.value, 10) || 20))}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Threshold before declaring a winner</p>
            </div>

            <div className="space-y-1">
              <label htmlFor="traffic-split" className="text-xs font-medium">Traffic Split (Control %)</label>
              <Input
                id="traffic-split"
                data-testid="input-traffic-split"
                type="number"
                min={10}
                max={90}
                value={trafficSplit}
                onChange={(e) => setTrafficSplit(Math.max(10, Math.min(90, parseInt(e.target.value, 10) || 50)))}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">50% = equal 50/50 split</p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-testid="btn-submit-create-experiment"
              disabled={isSubmitting || !controlVersionId || !variantVersionId}
              className="gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Launching..." : "Launch Experiment"}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
