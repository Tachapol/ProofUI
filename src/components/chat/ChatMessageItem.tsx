"use client";

import React, { useState } from "react";
import {
  Loader2,
  Clock,
  Copy,
  Check,
  RotateCw,
  Trash2,
  ArrowRight,
  FileCheck,
} from "lucide-react";
import { ChatMessage } from "@/lib/chat/schemas";
import { GenerationCandidate } from "@/lib/generation/schemas";
import { GenerationResultCard } from "./GenerationResultCard";

interface ChatMessageItemProps {
  message: ChatMessage;
  candidatesMap: Map<string, GenerationCandidate>;
  previewingCandidateId: string | null;
  onReviewProposal?: (proposalId: string) => void;
  onPreviewCandidate: (candidate: GenerationCandidate) => void;
  onCompareCandidate: (candidate: GenerationCandidate) => void;
  onApplyCandidate: (candidate: GenerationCandidate) => void;
  onRejectCandidate: (candidate: GenerationCandidate) => void;
  onReviseCandidate: (candidate: GenerationCandidate) => void;
}

export function ChatMessageItem({
  message,
  candidatesMap,
  previewingCandidateId,
  onReviewProposal,
  onPreviewCandidate,
  onCompareCandidate,
  onApplyCandidate,
  onRejectCandidate,
  onReviseCandidate,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);

  // 1. Timeline Event
  if (message.role === "timeline") {
    const eventBlock = message.blocks.find((b) => b.type === "timeline-event");
    return (
      <div className="flex items-center justify-center my-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span>{eventBlock?.type === "timeline-event" ? eventBlock.summary : "Document event"}</span>
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";

  const handleCopyText = async () => {
    const textBlock = message.blocks.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      await navigator.clipboard.writeText(textBlock.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 2. User Message Bubble (Electric Blue)
  if (isUser) {
    const textBlock = message.blocks.find((b) => b.type === "text");
    return (
      <div className="flex flex-col items-end my-3 group">
        <div className="max-w-[90%] rounded-2xl rounded-tr-xs bg-[#2563eb] text-white px-4 py-3 text-sm leading-relaxed shadow-lg font-sans select-text">
          {textBlock && textBlock.type === "text" ? textBlock.text : null}
        </div>

        {/* Footer beneath user message */}
        <div className="flex items-center gap-2 mt-1.5 pr-1 text-[11px] text-zinc-500 select-none">
          <Clock className="w-3 h-3" />
          <span>3:56 PM</span>
          <button
            type="button"
            onClick={handleCopyText}
            className="hover:text-zinc-300 p-0.5 transition-colors cursor-pointer"
            title="Copy message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
          <button
            type="button"
            className="hover:text-zinc-300 p-0.5 transition-colors cursor-pointer"
            title="Retry"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Assistant Message
  return (
    <div className="flex flex-col items-start my-3 w-full group">
      {message.blocks.map((block, idx) => {
        // Generation Candidate Result Card
        if (block.type === "generation-result") {
          const cand = candidatesMap.get(block.generationId);
          if (cand) {
            return (
              <GenerationResultCard
                key={idx}
                candidate={cand}
                isPreviewing={previewingCandidateId === cand.result.id}
                onPreview={onPreviewCandidate}
                onCompare={onCompareCandidate}
                onApply={onApplyCandidate}
                onReject={onRejectCandidate}
                onRevise={onReviseCandidate}
              />
            );
          }
          return null;
        }

        // Edit Proposal Block
        if (block.type === "edit-proposal") {
          return (
            <div
              key={idx}
              className="w-full my-2 rounded-2xl border border-zinc-800/90 bg-[#121214] p-3.5 space-y-2.5 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <FileCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">AI Edit Proposal</h4>
                    <p className="text-[11px] text-zinc-400">{block.proposalSummary}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onReviewProposal?.(block.proposalId)}
                  data-testid="btn-review-proposal"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  <span>Review Proposal</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        }

        // Progress stage
        if (block.type === "progress") {
          return (
            <div
              key={idx}
              data-testid="chat-progress-card"
              className="flex items-center gap-2.5 py-2 px-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs my-1"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span>{block.stage}</span>
            </div>
          );
        }

        // General text block
        if (block.type === "text") {
          return (
            <div
              key={idx}
              className="max-w-[95%] rounded-2xl border border-zinc-800/80 bg-[#121214] text-zinc-200 px-4 py-3 text-sm leading-relaxed shadow-lg font-sans"
            >
              <p className="whitespace-pre-wrap">{block.text}</p>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
