import { Conversation, ChatMessage, ChatContentBlock } from "./schemas";

export function generateConversationTitle(messageText: string): string {
  if (!messageText || !messageText.trim()) return "New Chat";
  const clean = messageText.trim().replace(/\s+/g, " ");
  if (clean.length <= 28) return clean;
  return clean.slice(0, 25) + "...";
}

export function createDefaultConversation(pageId = "main-page"): Conversation {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  return {
    id,
    title: "New Chat",
    pageId,
    createdAt: now,
    updatedAt: now,
    messageIds: [],
  };
}

export function createChatMessage(params: {
  conversationId: string;
  role: ChatMessage["role"];
  blocks: ChatContentBlock[];
  status?: ChatMessage["status"];
  basedOnRevision?: number;
  requestId?: string;
}): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    conversationId: params.conversationId,
    role: params.role,
    createdAt: new Date().toISOString(),
    status: params.status || "complete",
    basedOnRevision: params.basedOnRevision,
    requestId: params.requestId,
    blocks: params.blocks,
  };
}
