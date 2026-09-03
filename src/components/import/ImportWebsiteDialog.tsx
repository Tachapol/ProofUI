"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Palette,
  Layout,
  ImageIcon,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CapturePackage } from "@/lib/import/schemas";

const PROGRESS_STAGES = [
  "Validating URL",
  "Opening isolated browser",
  "Loading page",
  "Waiting for fonts and images",
  "Scrolling for lazy content",
  "Capturing screenshot",
  "Extracting structure",
  "Extracting styles",
  "Building asset manifest",
  "Generating DESIGN.md",
  "Preparing review",
];

interface ImportWebsiteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedData: {
    sanitizedHtml: string;
    designMarkdown: string;
    title: string;
    sourceUrl: string;
  }) => void;
}

export function ImportWebsiteDialog({
  isOpen,
  onClose,
  onImportComplete,
}: ImportWebsiteDialogProps) {
  const [step, setStep] = useState<"url" | "capturing" | "review">("url");
  const [url, setUrl] = useState("");
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState("Validating URL");
  const [progressPercent, setProgressPercent] = useState(0);
  const [capturePackage, setCapturePackage] = useState<CapturePackage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount or reset
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleStartCapture = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    setStep("capturing");
    setCurrentStage("Validating URL");
    setProgressPercent(5);

    const vpWidth = viewportMode === "desktop" ? 1440 : viewportMode === "tablet" ? 768 : 390;

    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed,
          viewport: { width: vpWidth, height: 900 },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to initiate URL capture.");
        setStep("url");
        return;
      }

      setActiveJobId(data.jobId);

      // Start polling for progress
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/imports/${data.jobId}`);
          if (!pollRes.ok) return;
          const pollData = await pollRes.json();

          if (pollData.currentStage) setCurrentStage(pollData.currentStage);
          if (typeof pollData.progressPercent === "number") setProgressPercent(pollData.progressPercent);

          if (pollData.status === "completed" && pollData.result) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setCapturePackage(pollData.result);
            setStep("review");
          } else if (pollData.status === "failed") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setErrorMessage(pollData.error || "Website capture failed.");
            setStep("url");
          }
        } catch {
          // Keep polling
        }
      }, 700);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error.");
      setStep("url");
    }
  };

  const handleCancelCapture = async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (activeJobId) {
      fetch(`/api/imports/${activeJobId}`, { method: "DELETE" }).catch(() => {});
    }
    setStep("url");
    setErrorMessage("Import process canceled.");
  };

  const handleCommitImport = async () => {
    if (!capturePackage || !activeJobId) return;

    try {
      const res = await fetch(`/api/imports/${activeJobId}/commit`, {
        method: "POST",
      });
      const committed = await res.json();

      onImportComplete({
        sanitizedHtml: committed.sanitizedHtml || capturePackage.sanitizedHtml,
        designMarkdown: committed.designMarkdown || capturePackage.designMarkdown,
        title: committed.title || capturePackage.title,
        sourceUrl: committed.sourceUrl || capturePackage.finalUrl,
      });
      onClose();
    } catch {
      setErrorMessage("Error applying import to editor.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      data-testid="import-website-dialog"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[90vh] text-zinc-900 dark:text-zinc-100 transition-colors">
        {/* Dialog Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/70 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Import Website Design Reference
              </h2>
              <p className="text-[11px] text-zinc-500">
                Capture, extract design tokens, generate DESIGN.md, and reconstruct safe editable HTML.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Step 1: URL Input */}
        {step === "url" && (
          <form onSubmit={handleStartCapture} noValidate className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Website Public URL
              </label>
              <Input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                data-testid="import-url-input"
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Only public, static pages are captured. Scripts, logins, and cookies are never accessed or imported.
              </p>
            </div>

            {/* Viewport Preset Picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Capture Viewport
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "desktop", label: "Desktop (1440px)" },
                  { id: "tablet", label: "Tablet (768px)" },
                  { id: "mobile", label: "Mobile (390px)" },
                ].map((vp) => (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setViewportMode(vp.id as "desktop" | "tablet" | "mobile")}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-left ${
                      viewportMode === vp.id
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs"
                        : "bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {vp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Legal Notice */}
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                <strong>Ethical Safeguard</strong>: Please import pages you own or are authorized to reference for design research. ProofUI reconstructs static styling for creative transformation.
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!url.trim()}
                data-testid="import-start-btn"
                className="gap-1.5 font-medium"
              >
                <span>Capture & Analyze</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Capturing Progress */}
        {step === "capturing" && (
          <div className="p-8 flex flex-col items-center justify-center space-y-6" data-testid="import-progress-container">
            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100" data-testid="import-progress-stage">
                {currentStage}
              </h3>
              <p className="text-xs text-zinc-500 font-mono">
                {progressPercent}% completed
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-md bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-zinc-900 dark:bg-zinc-100 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stage Checklist */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-zinc-500 max-w-md w-full pt-2">
              {PROGRESS_STAGES.map((s, idx) => {
                const isPassed = PROGRESS_STAGES.indexOf(currentStage) > idx || progressPercent === 100;
                const isCurrent = currentStage === s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    {isPassed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 animate-spin shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-zinc-300 dark:border-zinc-700 inline-block shrink-0" />
                    )}
                    <span className={isCurrent ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>
                      {s}
                    </span>
                  </div>
                );
              })}
            </div>

            <Button variant="outline" size="sm" onClick={handleCancelCapture}>
              Cancel Capture
            </Button>
          </div>
        )}

        {/* Step 3: Review Modal */}
        {step === "review" && capturePackage && (
          <div className="flex-1 flex flex-col overflow-hidden" data-testid="import-review-container">
            {/* Meta summary strip */}
            <div className="px-5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[250px]">
                  {capturePackage.title}
                </span>
                <span>•</span>
                <a
                  href={capturePackage.finalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 truncate max-w-[250px] flex items-center gap-1"
                >
                  <span>{capturePackage.finalUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <Badge variant="secondary">
                {capturePackage.viewport.width}px Viewport
              </Badge>
            </div>

            {/* Split Screen: Left Screenshot Preview, Right Data Tabs */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Screenshot Frame */}
              <div className="w-1/2 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-4 flex flex-col items-center overflow-hidden">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2 self-start">
                  Full Page Screenshot
                </span>
                <ScrollArea className="w-full flex-1 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 shadow-md">
                  <div className="p-2 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capturePackage.screenshot.pathOrUrl}
                      alt="Captured Website Screenshot"
                      data-testid="import-screenshot-preview"
                      className="w-full h-auto rounded border border-zinc-100 dark:border-zinc-800 object-top"
                    />
                  </div>
                </ScrollArea>
              </div>

              {/* Right Column: Extracted Tabs */}
              <div className="w-1/2 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
                <Tabs defaultValue="tokens" className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 pt-2 border-b border-zinc-200 dark:border-zinc-800">
                    <TabsList className="h-8">
                      <TabsTrigger value="tokens" className="text-xs gap-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        <span>Tokens</span>
                      </TabsTrigger>
                      <TabsTrigger value="structure" className="text-xs gap-1.5">
                        <Layout className="w-3.5 h-3.5" />
                        <span>Structure</span>
                      </TabsTrigger>
                      <TabsTrigger value="assets" className="text-xs gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Assets ({capturePackage.assets.length})</span>
                      </TabsTrigger>
                      <TabsTrigger value="design-md" className="text-xs gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>DESIGN.md</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab 1: Tokens */}
                  <TabsContent value="tokens" className="flex-1 p-4 overflow-y-auto custom-scrollbar m-0 space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Extracted Colors
                      </span>
                      <div className="grid grid-cols-2 gap-2" data-testid="import-token-table">
                        {[
                          { label: "Primary", token: capturePackage.designTokens.colors.primary },
                          { label: "Background", token: capturePackage.designTokens.colors.background },
                          { label: "Surface", token: capturePackage.designTokens.colors.surface },
                          { label: "Text", token: capturePackage.designTokens.colors.textPrimary },
                        ].map((c) => (
                          <div key={c.label} className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2.5">
                            <span
                              className="w-6 h-6 rounded-md border border-black/10 shrink-0 shadow-xs"
                              style={{ backgroundColor: c.token?.value || "#ccc" }}
                            />
                            <div className="overflow-hidden">
                              <span className="text-[10px] text-zinc-500 block">{c.label}</span>
                              <span className="font-mono text-xs font-semibold truncate block">
                                {c.token?.value || "Not found"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Typography
                      </span>
                      <div className="space-y-1.5 text-xs">
                        {capturePackage.designTokens.typography.fontFamilies.map((f, i) => (
                          <div key={i} className="flex items-center justify-between font-mono bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                            <span>{f.value}</span>
                            <span className="text-[10px] text-zinc-500">Used {f.frequency}x</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Spacing & Container
                      </span>
                      <div className="flex flex-wrap gap-1 font-mono text-xs">
                        {capturePackage.designTokens.spacing.paddingScale.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            {p.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Structure & Signals */}
                  <TabsContent value="structure" className="flex-1 p-4 overflow-y-auto custom-scrollbar m-0 space-y-4">
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Component Signals ({capturePackage.components.length})
                      </span>
                      <div className="space-y-2">
                        {capturePackage.components.map((comp, i) => (
                          <div key={i} className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{comp.kind}</span>
                              <Badge variant="secondary">{(comp.confidence * 100).toFixed(0)}% Match</Badge>
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                              {comp.evidence.join("; ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                        Heading Progression
                      </span>
                      <div className="space-y-1 text-xs font-mono">
                        {capturePackage.structure.headings.slice(0, 8).map((h, i) => (
                          <div key={i} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-800">
                            <Badge variant="outline">H{h.level}</Badge>
                            <span className="truncate">{h.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Assets */}
                  <TabsContent value="assets" className="flex-1 p-4 overflow-y-auto custom-scrollbar m-0 space-y-2" data-testid="import-asset-manifest">
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">
                      Asset Manifest ({capturePackage.assets.length})
                    </span>
                    <div className="space-y-2">
                      {capturePackage.assets.map((asset) => (
                        <div key={asset.id} className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs flex items-center justify-between gap-2">
                          <div className="overflow-hidden">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize mr-2">
                              [{asset.type}]
                            </span>
                            <span className="font-mono text-zinc-500 text-[11px] truncate">
                              {asset.normalizedUrl.slice(0, 45)}...
                            </span>
                          </div>
                          <Badge variant={asset.downloadable ? "success" : "secondary"}>
                            {asset.downloadable ? "Public" : "Restricted"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Tab 4: DESIGN.md */}
                  <TabsContent value="design-md" className="flex-1 p-4 overflow-y-auto custom-scrollbar m-0" data-testid="import-design-markdown">
                    <pre className="text-[11px] font-mono p-3 rounded-lg bg-zinc-950 text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-zinc-800">
                      {capturePackage.designMarkdown}
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelCapture}
                data-testid="btn-cancel-import"
              >
                Cancel
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleCommitImport}
                  data-testid="btn-confirm-import"
                  className="gap-1.5 font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import into Editor</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
