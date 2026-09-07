"use client";

import React, { useState } from "react";
import { Sparkles, PanelLeftOpen } from "lucide-react";
import { SerializedNode } from "@/lib/bridge/types";
import { AIEditScope } from "@/lib/ai/schemas";
import { Conversation, ChatMessage, ChatAttachment } from "@/lib/chat/schemas";
import { GenerationCandidate, PageGenerationRequest } from "@/lib/generation/schemas";
import { EditorDocumentContext } from "@/lib/editor/persistence";
import { ConversationHeader } from "./ConversationHeader";
import { ChatMessageList } from "./ChatMessageList";
import { ChatComposer } from "./ChatComposer";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  width: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onMouseDownResize: (e: React.MouseEvent) => void;
  onKeyDownResize: (e: React.KeyboardEvent) => void;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  selectedNode: SerializedNode | null;
  documentRevision: number;
  documentContext?: EditorDocumentContext;
  isProcessing: boolean;
  currentStage?: string | null;
  candidatesMap: Map<string, GenerationCandidate>;
  previewingCandidateId: string | null;
  onReviewProposal?: (proposalId: string) => void;
  onPreviewCandidate: (candidate: GenerationCandidate) => void;
  onCompareCandidate: (candidate: GenerationCandidate) => void;
  onApplyCandidate: (candidate: GenerationCandidate) => void;
  onRejectCandidate: (candidate: GenerationCandidate) => void;
  onReviseCandidate: (candidate: GenerationCandidate) => void;
  onSendEdit: (instruction: string, scope: AIEditScope, attachments: ChatAttachment[]) => Promise<void>;
  onSendGenerate: (
    instruction: string,
    scope: "new_page" | "new_version",
    attachments: ChatAttachment[],
    generationContext: PageGenerationRequest["context"],
    provider: "qwen" | "gemini" | "mock"
  ) => Promise<void>;
  onCancel: () => void;
}

export function ChatSidebar({
  width,
  isCollapsed,
  onToggleCollapse,
  onMouseDownResize,
  onKeyDownResize,
  conversations,
  activeConversation,
  messages,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  selectedNode,
  documentRevision,
  documentContext,
  isProcessing,
  currentStage,
  candidatesMap,
  previewingCandidateId,
  onReviewProposal,
  onPreviewCandidate,
  onCompareCandidate,
  onApplyCandidate,
  onRejectCandidate,
  onReviseCandidate,
  onSendEdit,
  onSendGenerate,
  onCancel,
}: ChatSidebarProps) {
  const [revisePrompt, setRevisePrompt] = useState("");

  const handleReviseTrigger = (candidate: GenerationCandidate) => {
    setRevisePrompt(`Revise page generation "${candidate.result.summary}": `);
    onReviseCandidate(candidate);
  };

  // Collapsed rail state
  if (isCollapsed) {
    return (
      <div className="w-12 h-full border-r border-border bg-card flex flex-col items-center py-3 gap-3 shrink-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapse}
          data-testid="chat-expand-btn"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Expand AI Chat Sidebar"
          aria-label="Expand AI Chat Sidebar"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
        <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      data-testid="ai-composer-panel"
      aria-label="AI Chat Sidebar"
      className="relative h-full border-r border-zinc-800/80 bg-[#09090b] flex flex-col shrink-0 z-20 select-text"
    >
      {/* Header */}
      <ConversationHeader
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onRenameConversation={onRenameConversation}
        onDeleteConversation={onDeleteConversation}
        onToggleCollapse={onToggleCollapse}
      />

      {/* Message List */}
      <ChatMessageList
        messages={messages}
        candidatesMap={candidatesMap}
        previewingCandidateId={previewingCandidateId}
        onReviewProposal={onReviewProposal}
        onPreviewCandidate={onPreviewCandidate}
        onCompareCandidate={onCompareCandidate}
        onApplyCandidate={onApplyCandidate}
        onRejectCandidate={onRejectCandidate}
        onReviseCandidate={handleReviseTrigger}
      />

      {/* Composer Wrapper */}
      <div className="p-3 pt-0 shrink-0">
        <ChatComposer
          selectedNode={selectedNode}
          documentRevision={documentRevision}
          documentContext={documentContext}
          isProcessing={isProcessing}
          currentStage={currentStage}
          initialPrompt={revisePrompt}
          onSendEdit={onSendEdit}
          onSendGenerate={(instruction, scope, attachments, provider) => {
            const genContext: PageGenerationRequest["context"] = {
              screenshotReference: documentContext?.screenshotReference,
              designMarkdown: documentContext?.designMarkdown,
              capturedStructure: documentContext?.structure,
              designTokens: documentContext?.designTokens,
              assets: documentContext?.assets,
            };
            return onSendGenerate(instruction, scope, attachments, genContext, provider);
          }}
          onCancel={onCancel}
        />
      </div>

      {/* Resizer Handle */}
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={320}
        aria-valuemax={520}
        aria-label="Resize chat sidebar"
        data-testid="chat-resize-handle"
        onMouseDown={onMouseDownResize}
        onKeyDown={onKeyDownResize}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors z-30 focus:outline-none focus:bg-blue-500"
      />
    </aside>
  );
}
