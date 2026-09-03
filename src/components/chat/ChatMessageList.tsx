"use client";

import React, { useRef, useEffect } from "react";
import { ChatMessage } from "@/lib/chat/schemas";
import { GenerationCandidate } from "@/lib/generation/schemas";
import { ChatMessageItem } from "./ChatMessageItem";

interface ChatMessageListProps {
  messages: ChatMessage[];
  candidatesMap: Map<string, GenerationCandidate>;
  previewingCandidateId: string | null;
  onReviewProposal?: (proposalId: string) => void;
  onPreviewCandidate: (candidate: GenerationCandidate) => void;
  onCompareCandidate: (candidate: GenerationCandidate) => void;
  onApplyCandidate: (candidate: GenerationCandidate) => void;
  onRejectCandidate: (candidate: GenerationCandidate) => void;
  onReviseCandidate: (candidate: GenerationCandidate) => void;
}

export function ChatMessageList({
  messages,
  candidatesMap,
  previewingCandidateId,
  onReviewProposal,
  onPreviewCandidate,
  onCompareCandidate,
  onApplyCandidate,
  onRejectCandidate,
  onReviseCandidate,
}: ChatMessageListProps) {
  const scrollBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      role="log"
      aria-label="Conversation history"
      className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
    >
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground text-xs">AI Design Assistant</p>
          <p className="text-[11px] max-w-[240px] leading-relaxed">
            Select an element to edit Tailwind styles, or describe a complete page layout to generate.
          </p>
        </div>
      ) : (
        messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            candidatesMap={candidatesMap}
            previewingCandidateId={previewingCandidateId}
            onReviewProposal={onReviewProposal}
            onPreviewCandidate={onPreviewCandidate}
            onCompareCandidate={onCompareCandidate}
            onApplyCandidate={onApplyCandidate}
            onRejectCandidate={onRejectCandidate}
            onReviseCandidate={onReviseCandidate}
          />
        ))
      )}
      <div ref={scrollBottomRef} />
    </div>
  );
}
