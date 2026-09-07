import { useState, useCallback, useRef } from "react";
import {
  Conversation,
  ChatMessage,
  ChatContentBlock,
  ChatAttachment,
} from "./schemas";
import {
  createDefaultConversation,
  createChatMessage,
  generateConversationTitle,
} from "./chat-state";
import { PageGenerationRequest, PageGenerationResult } from "../generation/schemas";
import { AIEditProposal, AIEditScope } from "../ai/schemas";
import { readGenerationStream } from "./generation-stream";

interface UseChatWorkspaceParams {
  initialConversations?: Conversation[];
  initialMessages?: ChatMessage[];
  initialActiveId?: string | null;
  onPerformEdit?: (params: {
    instruction: string;
    scope: AIEditScope;
    signal?: AbortSignal;
  }) => Promise<AIEditProposal>;
  onGenerationResultReady?: (result: PageGenerationResult) => void;
  documentRevision: number;
}

export function useChatWorkspace({
  initialConversations = [],
  initialMessages = [],
  initialActiveId = null,
  onPerformEdit,
  onGenerationResultReady,
  documentRevision,
}: UseChatWorkspaceParams) {
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    if (initialConversations.length > 0) return initialConversations;
    return [createDefaultConversation()];
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => {
    if (initialActiveId) return initialActiveId;
    return initialConversations[0]?.id || null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Active conversation helper
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || conversations[0] || null;

  // Messages in current conversation
  const activeMessages = activeConversation
    ? messages.filter((m) => m.conversationId === activeConversation.id)
    : [];

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    const newConv = createDefaultConversation();
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    return newConv;
  }, []);

  // Rename conversation
  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim(), updatedAt: new Date().toISOString() } : c))
    );
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id);
        if (remaining.length === 0) {
          const fresh = createDefaultConversation();
          setActiveConversationId(fresh.id);
          return [fresh];
        }
        if (activeConversationId === id) {
          setActiveConversationId(remaining[0].id);
        }
        return remaining;
      });
      setMessages((prev) => prev.filter((m) => m.conversationId !== id));
    },
    [activeConversationId]
  );

  // Switch conversation
  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  // Append a timeline event message to the current conversation
  const addTimelineEvent = useCallback(
    (
      event:
        | "manual-edit"
        | "website-import"
        | "proposal-applied"
        | "generation-applied"
        | "version-restored",
      summary: string
    ) => {
      const convId = activeConversation?.id || conversations[0]?.id;
      if (!convId) return;

      const timelineMsg = createChatMessage({
        conversationId: convId,
        role: "timeline",
        blocks: [{ type: "timeline-event", event, summary }],
      });

      setMessages((prev) => [...prev, timelineMsg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messageIds: [...c.messageIds, timelineMsg.id], updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    [activeConversation, conversations]
  );

  // Cancel in-flight request
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setCurrentStage(null);
  }, []);

  // Submit Prompt in Edit mode
  const submitEdit = useCallback(
    async (instruction: string, scope: AIEditScope, attachments: ChatAttachment[] = []) => {
      if (!instruction.trim() || isProcessing) return;

      const conv = activeConversation || handleNewConversation();
      setIsProcessing(true);
      setCurrentStage("Simulating proposal");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 1. Post user message
      const userBlocks: ChatContentBlock[] = [{ type: "text", text: instruction.trim() }];
      attachments.forEach((att) => {
        userBlocks.push({ type: "attachment", attachmentId: att.id });
      });

      const userMsg = createChatMessage({
        conversationId: conv.id,
        role: "user",
        blocks: userBlocks,
        basedOnRevision: documentRevision,
      });

      // Update title if default
      if (conv.title === "New Chat") {
        const autoTitle = generateConversationTitle(instruction);
        handleRenameConversation(conv.id, autoTitle);
      }

      setMessages((prev) => [...prev, userMsg]);

      try {
        if (!onPerformEdit) {
          throw new Error("AI Edit handler is not configured.");
        }

        const proposal = await onPerformEdit({
          instruction: instruction.trim(),
          scope,
          signal: controller.signal,
        });

        // 2. Post assistant proposal card
        const assistantMsg = createChatMessage({
          conversationId: conv.id,
          role: "assistant",
          status: "complete",
          basedOnRevision: documentRevision,
          blocks: [
            {
              type: "text",
              text: `I've prepared a structured edit proposal: "${proposal.summary}"`,
            },
            {
              type: "edit-proposal",
              proposalId: proposal.proposalId,
              proposalSummary: proposal.summary,
              status: "pending",
            },
          ],
        });

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          const cancelMsg = createChatMessage({
            conversationId: conv.id,
            role: "assistant",
            status: "canceled",
            blocks: [{ type: "warning", message: "Edit request was canceled." }],
          });
          setMessages((prev) => [...prev, cancelMsg]);
        } else {
          const errMsg = createChatMessage({
            conversationId: conv.id,
            role: "assistant",
            status: "failed",
            blocks: [
              {
                type: "warning",
                message: err instanceof Error ? err.message : "Failed to generate edit proposal.",
              },
            ],
          });
          setMessages((prev) => [...prev, errMsg]);
        }
      } finally {
        setIsProcessing(false);
        setCurrentStage(null);
        abortControllerRef.current = null;
      }
    },
    [
      activeConversation,
      handleNewConversation,
      handleRenameConversation,
      isProcessing,
      documentRevision,
      onPerformEdit,
    ]
  );

  // Submit Prompt in Generate mode
  const submitGenerate = useCallback(
    async (
      instruction: string,
      scope: "new_page" | "new_version",
      attachments: ChatAttachment[] = [],
      generationContext: PageGenerationRequest["context"],
      provider: "qwen" | "gemini" | "mock" = "qwen"
    ) => {
      if (!instruction.trim() || isProcessing) return;

      const conv = activeConversation || handleNewConversation();
      setIsProcessing(true);
      setCurrentStage("Preparing context");

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 1. Post user message
      const userBlocks: ChatContentBlock[] = [{ type: "text", text: instruction.trim() }];
      attachments.forEach((att) => {
        userBlocks.push({ type: "attachment", attachmentId: att.id });
      });

      const userMsg = createChatMessage({
        conversationId: conv.id,
        role: "user",
        blocks: userBlocks,
        basedOnRevision: documentRevision,
      });

      // Update title if default
      if (conv.title === "New Chat") {
        const autoTitle = generateConversationTitle(instruction);
        handleRenameConversation(conv.id, autoTitle);
      }

      setMessages((prev) => [...prev, userMsg]);

      // Temporary assistant streaming message
      const assistantMsgId = `msg_${Date.now()}_stream`;
      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        conversationId: conv.id,
        role: "assistant",
        status: "streaming",
        createdAt: new Date().toISOString(),
        basedOnRevision: documentRevision,
        blocks: [{ type: "progress", stage: "Preparing context" }],
      };
      setMessages((prev) => [...prev, initialAssistantMsg]);

      try {
const reqPayload: PageGenerationRequest = {
        requestId: `req_${Date.now()}`,
        conversationId: conv.id,
        instruction: instruction.trim(),
        scope,
        basedOnRevision: documentRevision,
        attachmentIds: attachments.map((a) => a.id),
        context: generationContext,
        provider,
      };

        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(reqPayload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Server error (${res.status})`);
        }

        const result = await readGenerationStream(res, {
          onStatus: (stage) => {
            setCurrentStage(stage);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMsgId
                  ? {
                      ...message,
                      blocks: [{ type: "progress", stage }],
                    }
                  : message
              )
            );
          },
        });

        // Notify parent of candidate result
        onGenerationResultReady?.(result);

        // Replace streaming message with generation-result block
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  status: "complete",
                  blocks: [
                    {
                      type: "text",
                      text: `✨ Full-page generation ready for review: "${result.summary}"`,
                    },
                    {
                      type: "generation-result",
                      generationId: result.id,
                      status: "ready",
                    },
                  ],
                }
              : m
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: "canceled",
                    blocks: [{ type: "warning", message: "Generation request was canceled." }],
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    status: "failed",
                    blocks: [
                      {
                        type: "warning",
                        message:
                          err instanceof Error ? err.message : "Failed to generate page candidate.",
                      },
                    ],
                  }
                : m
            )
          );
        }
      } finally {
        setIsProcessing(false);
        setCurrentStage(null);
        abortControllerRef.current = null;
      }
    },
    [
      activeConversation,
      handleNewConversation,
      handleRenameConversation,
      isProcessing,
      documentRevision,
      onGenerationResultReady,
    ]
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    activeMessages,
    messages,
    isProcessing,
    currentStage,
    handleNewConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleSelectConversation,
    addTimelineEvent,
    submitEdit,
    submitGenerate,
    handleCancel,
  };
}
