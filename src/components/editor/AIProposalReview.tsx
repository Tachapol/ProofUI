"use client";

import React, { useMemo } from "react";
import { Check, X, AlertTriangle, AlertCircle, Sparkles, Hash } from "lucide-react";
import { AIEditProposal, AIEditScope } from "@/lib/ai/schemas";
import { describeOperation } from "@/lib/ai/operation-descriptions";
import { simulateProposal } from "@/lib/ai/proposal-simulator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AIProposalReviewProps {
  proposal: AIEditProposal | null;
  scope: AIEditScope;
  canonicalSource: string;
  currentRevision: number;
  onApply: () => void;
  onReject: () => void;
}

export function AIProposalReview({
  proposal,
  scope,
  canonicalSource,
  currentRevision,
  onApply,
  onReject,
}: AIProposalReviewProps) {
  const simulation = useMemo(() => {
    if (!proposal) return null;
    return simulateProposal(proposal, canonicalSource, currentRevision);
  }, [proposal, canonicalSource, currentRevision]);

  const describedOperations = useMemo(() => {
    if (!proposal) return [];
    return proposal.operations.map((op) => describeOperation(op, canonicalSource));
  }, [proposal, canonicalSource]);

  if (!proposal) return null;

  const isStale = proposal.basedOnRevision < currentRevision;
  const canApply = simulation?.canApply && !isStale && proposal.operations.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="ai-proposal-review-modal"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] text-zinc-900 dark:text-zinc-100 transition-colors">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between shrink-0 bg-zinc-50/80 dark:bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Edit Proposal</h3>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                <span className="capitalize">Scope: {scope.replace("_", " ")}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5 font-mono">
                  <Hash className="w-3 h-3 text-zinc-400" />
                  <span>rev {proposal.basedOnRevision}</span>
                </span>
                <span>•</span>
                <span>{proposal.operations.length} {proposal.operations.length === 1 ? "operation" : "operations"}</span>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onReject}
            className="h-7 w-7"
            aria-label="Close review"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Body with ScrollArea */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Summary & Rationale */}
            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {proposal.summary}
              </div>
              {proposal.rationale && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {proposal.rationale}
                </p>
              )}
            </div>

            {/* Stale Warning */}
            {isStale && (
              <div
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2"
                data-testid="proposal-stale-warning"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Proposal is Stale</span>
                  <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                    The document was modified (now at revision {currentRevision}) since this proposal was generated (at revision {proposal.basedOnRevision}). Please regenerate to apply edits safely.
                  </span>
                </div>
              </div>
            )}

            {/* Simulation Errors */}
            {simulation && !simulation.canApply && simulation.errors.length > 0 && (
              <div
                className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1"
                data-testid="proposal-simulation-errors"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Simulation Verification Failed</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-rose-700/90 dark:text-rose-300/90 space-y-0.5">
                  {simulation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Proposal Warnings */}
            {proposal.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/40 text-zinc-600 dark:text-zinc-400 text-xs space-y-1">
                {proposal.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Operations List */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider block">
                Proposed Operations ({proposal.operations.length})
              </span>

              {describedOperations.length === 0 ? (
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500 italic">
                  No operations to perform.
                </div>
              ) : (
                <div className="space-y-2">
                  {describedOperations.map((desc, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs"
                      data-testid={`proposed-op-${idx}`}
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{desc.actionText}</span>
                        <span className="text-[10px] text-zinc-500">#{desc.nodeId}</span>
                      </div>

                      <div className="space-y-1">
                        {desc.details.map((detail, dIdx) => (
                          <div key={dIdx} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="text-zinc-500 w-16 shrink-0">{detail.label}:</span>
                            {detail.variant === "remove" && (
                              <span className="text-rose-600 dark:text-rose-400 line-through bg-rose-500/10 px-1 rounded">
                                {detail.value}
                              </span>
                            )}
                            {detail.variant === "add" && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-1 rounded">
                                {detail.value}
                              </span>
                            )}
                            {detail.variant === "neutral" && (
                              <span className="text-zinc-600 dark:text-zinc-400">{detail.value}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onReject}
            data-testid="btn-reject-proposal"
          >
            Reject Proposal
          </Button>

          <Button
            variant="default"
            size="sm"
            disabled={!canApply}
            onClick={onApply}
            data-testid="btn-apply-proposal"
            className="gap-1.5 font-medium"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply All Operations</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
