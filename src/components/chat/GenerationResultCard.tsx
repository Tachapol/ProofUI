"use client";

import React, { useState, useMemo } from "react";
import {
  ExternalLink,
  Play,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Trash2,
  ArrowRightLeft,
  Zap,
} from "lucide-react";
import { GenerationCandidate } from "@/lib/generation/schemas";
import { formatHtml } from "@/lib/code/html-format";

interface GenerationResultCardProps {
  candidate: GenerationCandidate;
  isPreviewing: boolean;
  onPreview: (candidate: GenerationCandidate) => void;
  onCompare: (candidate: GenerationCandidate) => void;
  onApply: (candidate: GenerationCandidate) => void;
  onReject: (candidate: GenerationCandidate) => void;
  onRevise: (candidate: GenerationCandidate) => void;
}

export function GenerationResultCard({
  candidate,
  isPreviewing,
  onPreview,
  onCompare,
  onApply,
  onReject,
  onRevise,
}: GenerationResultCardProps) {
  const { status } = candidate;
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  const isStale = status === "stale";
  const isApplied = status === "applied";
  const providerLabel = candidate.result.modelName
    ? `${candidate.result.providerName ?? "AI"} / ${candidate.result.modelName}`
    : candidate.result.providerName ?? "mock / deterministic";
  const createdTime = new Date(candidate.result.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const usage = candidate.usage || candidate.result.usage;
  const durationMs = candidate.durationMs || candidate.result.durationMs || usage?.durationMs;
  const durationText = durationMs
    ? durationMs < 1000
      ? `${durationMs}ms`
      : `${(durationMs / 1000).toFixed(1)}s`
    : null;

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(formatHtml(candidate.sanitizedHtml));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Syntax highlighting simulation for code view
  const formattedCodeLines = useMemo(() => {
    const raw = formatHtml(candidate.sanitizedHtml).trim();
    return raw.split("\n").slice(0, 45); // First 45 lines formatted
  }, [candidate.sanitizedHtml]);

  const highlightLine = (line: string) => {
    // Basic syntax coloration
    if (line.includes("<script") || line.includes("</script>")) {
      return <span className="text-emerald-400">{line}</span>;
    }
    if (line.includes("<body") || line.includes("</body") || line.includes("</html>")) {
      return <span className="text-cyan-400">{line}</span>;
    }
    if (line.includes("addEventListener") || line.includes("function") || line.includes("=>")) {
      const parts = line.split(/(["'].*?["']|addEventListener|function|const|let|var|if|return|true|false)/g);
      return (
        <>
          {parts.map((part, i) => {
            if (part === "addEventListener" || part === "function") {
              return <span key={i} className="text-yellow-400">{part}</span>;
            }
            if (part === "if" || part === "const" || part === "return") {
              return <span key={i} className="text-purple-400">{part}</span>;
            }
            if (part === "true" || part === "false") {
              return <span key={i} className="text-amber-400">{part}</span>;
            }
            if (part.startsWith('"') || part.startsWith("'")) {
              return <span key={i} className="text-orange-300">{part}</span>;
            }
            return <span key={i} className="text-zinc-300">{part}</span>;
          })}
        </>
      );
    }
    return <span className="text-zinc-300">{line}</span>;
  };

  return (
    <div className="w-full my-2 space-y-1.5" data-testid="generation-result-card">
      {/* Sleek Dark Window Container */}
      <div className="rounded-2xl border border-zinc-800/90 bg-[#121214] text-zinc-100 overflow-hidden shadow-2xl">
        {/* Card Titlebar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800/80 bg-[#18181b]/70 select-none">
          {/* Left Actions: Traffic Lights + View + Play */}
          <div className="flex items-center gap-2">
            {/* macOS traffic lights */}
            <div className="flex items-center gap-1.5 mr-1">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600/80" />
            </div>

            {/* View in Canvas Button */}
            <button
              type="button"
              onClick={() => onPreview(candidate)}
              data-testid="btn-preview-candidate"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                isPreviewing
                  ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
                  : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60 hover:text-white"
              }`}
              title="Preview in Canvas"
            >
              <ExternalLink className="w-3 h-3" />
              <span>{isPreviewing ? "Viewing" : "View"}</span>
            </button>

            {/* Run / Apply Button */}
            <button
              type="button"
              disabled={isStale || isApplied}
              onClick={() => onApply(candidate)}
              data-testid="btn-apply-candidate"
              className="p-1 rounded-md text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors disabled:opacity-40 cursor-pointer"
              title="Apply candidate to Canvas"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            {candidate.optimizationComparison && (
              <span
                data-testid="result-card-ux-score-delta"
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  candidate.optimizationComparison.scoreDelta > 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
              >
                {candidate.optimizationComparison.scoreDelta > 0
                  ? `UX score: ${candidate.optimizationComparison.baselineScore} → ${candidate.optimizationComparison.candidateScore} (+${candidate.optimizationComparison.scoreDelta})`
                  : `UX score: ${candidate.optimizationComparison.baselineScore} → ${candidate.optimizationComparison.candidateScore} (${candidate.optimizationComparison.scoreDelta})`}
              </span>
            )}
          </div>

          {/* Right Actions: Copy + [Preview | Code] Segmented Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Segmented [Preview | Code] Toggle */}
            <div className="flex items-center bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "code"
                    ? "bg-zinc-800 text-white shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Code
              </button>
            </div>
          </div>
        </div>

        {/* Card Content Area */}
        {activeTab === "code" ? (
          <div className="relative p-4 font-mono text-xs leading-relaxed overflow-x-auto max-h-96 bg-[#0c0c0e] text-zinc-200 select-text">
            <pre className="space-y-0.5">
              {formattedCodeLines.map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 select-none text-zinc-600 text-[11px] shrink-0 text-right pr-3">
                    {idx + 1}
                  </span>
                  <span className="flex-1 whitespace-pre">{highlightLine(line)}</span>
                </div>
              ))}
            </pre>
          </div>
        ) : (
          <div className="p-3 bg-[#0c0c0e] space-y-3">
            {/* Live miniature iframe preview */}
            <div className="w-full h-64 rounded-xl border border-zinc-800 overflow-hidden bg-white shadow-inner relative">
              <iframe
                title="Generated Preview"
                srcDoc={candidate.sanitizedHtml}
                sandbox="allow-scripts"
                className="w-full h-full border-none pointer-events-none transform origin-top-left"
              />
            </div>

            {/* Candidate Controls in Preview Mode */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onCompare(candidate)}
                  data-testid="btn-compare-candidate"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
                  <span>Compare</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRevise(candidate)}
                  data-testid="btn-revise-candidate"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 text-zinc-400" />
                  <span>Revise</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onReject(candidate)}
                  data-testid="btn-reject-candidate"
                  className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={isStale || isApplied}
                  onClick={() => onApply(candidate)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Line beneath card */}
      <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500 select-none flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-3 h-3" />
          <span>{createdTime}</span>
          <span>•</span>
          <span className="font-mono text-zinc-400">{providerLabel}</span>
          {usage && (
            <>
              <span>•</span>
              <div
                data-testid="generation-token-metrics"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300"
              >
                <span>
                  <span className="text-zinc-500">Token In:</span>{" "}
                  <strong className="text-zinc-200">{usage.promptTokens.toLocaleString()}</strong>
                </span>
                <span className="text-zinc-700">|</span>
                <span>
                  <span className="text-zinc-500">Token Out:</span>{" "}
                  <strong className="text-zinc-200">{usage.completionTokens.toLocaleString()}</strong>
                </span>
                {durationText && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span className="text-emerald-400 flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />
                      {durationText}
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-500">
          <button
            type="button"
            onClick={handleCopyCode}
            className="hover:text-zinc-300 transition-colors p-0.5 cursor-pointer"
            title="Copy code"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onReject(candidate)}
            className="hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
            title="Discard generation"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
