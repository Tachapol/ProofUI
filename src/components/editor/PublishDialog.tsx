"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DocumentVersion } from "@/lib/generation/schemas";
import { PublishedMetadata } from "@/lib/production/schemas";
import {
  Rocket,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Download,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";

export interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canonicalHtml: string;
  currentRevision: number;
  versions: DocumentVersion[];
  projectId?: string;
  pageId?: string;
  onPublished?: (metadata: PublishedMetadata, publishedUrl: string) => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  canonicalHtml,
  currentRevision,
  versions,
  projectId = "proj_default",
  pageId = "page_landing",
  onPublished,
}: PublishDialogProps) {
  // Target version selection (default to latest or current revision)
  const currentVersion = versions.find((v) => v.revision === currentRevision) || versions[versions.length - 1];
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    currentVersion?.id || "ver_current"
  );
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{
    metadata: PublishedMetadata;
    publishedUrl: string;
    html: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setError(null);
      setPublishResult(null);
      setCopied(false);
      const matched = versions.find((v) => v.revision === currentRevision);
      if (matched) {
        setSelectedVersionId(matched.id);
      } else if (versions.length > 0) {
        setSelectedVersionId(versions[versions.length - 1].id);
      }
    }
    onOpenChange(isOpen);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      const chosenVersion = versions.find((v) => v.id === selectedVersionId);
      const htmlToPublish = chosenVersion?.htmlReference || canonicalHtml;

      const response = await fetch("/api/production/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          pageId,
          versionId: selectedVersionId,
          title: chosenVersion?.summary || "Published Landing Page",
          html: htmlToPublish,
          trackingEnabled,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Publish failed (${response.status})`);
      }

      const data = await response.json();
      setPublishResult({
        metadata: data.metadata,
        publishedUrl: data.publishedUrl,
        html: data.html,
      });

      onPublished?.(data.metadata, data.publishedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish page.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyLink = () => {
    if (!publishResult) return;
    const fullUrl = `${window.location.origin}${publishResult.publishedUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHtml = () => {
    if (!publishResult) return;
    const blob = new Blob([publishResult.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `published-${projectId}-${selectedVersionId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="publish-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>Publish & Deploy Document</DialogTitle>
              <DialogDescription>
                Deploy an applied version with privacy-safe telemetry collection.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {publishResult ? (
          /* Published Success View */
          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-sm">Successfully Published!</p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  Version <span className="font-mono font-bold">{publishResult.metadata.versionId}</span> is now live with stable identifiers and {publishResult.metadata.trackingEnabled ? "active telemetry tracking" : "tracking disabled"}.
                </p>
              </div>
            </div>

            {/* Stable Identifiers Summary */}
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono space-y-1 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Project ID:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{publishResult.metadata.projectId}</span>
              </div>
              <div className="flex justify-between">
                <span>Page ID:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{publishResult.metadata.pageId}</span>
              </div>
              <div className="flex justify-between">
                <span>Version ID:</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{publishResult.metadata.versionId}</span>
              </div>
              <div className="flex justify-between">
                <span>Tracker:</span>
                <span className="text-zinc-800 dark:text-zinc-200">
                  {publishResult.metadata.trackingEnabled ? "ProofUI v1.0.0 (Active)" : "None"}
                </span>
              </div>
            </div>

            {/* Live Link and Actions */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Live Deployment URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}${publishResult.publishedUrl}`}
                  data-testid="published-url-link"
                  className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md select-all"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="gap-1 text-xs"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  asChild
                  className="gap-1 text-xs bg-indigo-600 hover:bg-indigo-700"
                >
                  <a
                    href={publishResult.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open</span>
                  </a>
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtml}
                className="gap-1.5 text-xs mr-auto"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Standalone HTML</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Publish Configuration Form */
          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Version Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Document Version to Publish:
              </label>
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                data-testid="publish-version-select"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} (Rev {v.revision}) — {v.summary}
                  </option>
                ))}
              </select>
            </div>

            {/* Metadata Preview */}
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Target Project:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{projectId}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Target Page:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{pageId}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-zinc-500">Endpoint:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">/api/production/telemetry</span>
              </div>
            </div>

            {/* Privacy-Safe Opt-In Tracking */}
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="enable-tracking"
                  checked={trackingEnabled}
                  onChange={(e) => setTrackingEnabled(e.target.checked)}
                  data-testid="publish-tracking-checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="text-xs space-y-1 cursor-pointer">
                  <label htmlFor="enable-tracking" className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Enable Privacy-Safe Interaction Tracking (Opt-In)</span>
                  </label>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Embeds the lightweight first-party ProofUI Tracker (v1.0.0, &lt;3KB) to collect scroll depth, CTA clicks, viewport category, and bounce buckets.
                  </p>
                </div>
              </div>

              {/* Strict Privacy Guarantee Box */}
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 text-[10px] space-y-1 text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Lock className="w-3 h-3" />
                  <span>Privacy-First Guarantee: Never Collected</span>
                </div>
                <p>
                  Zero form field inputs, passwords, cookies, localStorage, query params, IP addresses, full text, or cross-site identifiers are ever accessed or transmitted.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handlePublish}
                disabled={isPublishing}
                data-testid="btn-confirm-publish"
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Publish Version</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
