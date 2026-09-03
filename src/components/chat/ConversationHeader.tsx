"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  PanelLeftClose,
  Folder,
  Database,
  Layers,
} from "lucide-react";
import { Conversation } from "@/lib/chat/schemas";

interface ConversationHeaderProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onToggleCollapse: () => void;
}

export function ConversationHeader({
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
  onToggleCollapse,
}: ConversationHeaderProps) {
  const [isChatsOpen, setIsChatsOpen] = useState(false);
  const [isPagesOpen, setIsPagesOpen] = useState(false);
  const [isCmsOpen, setIsCmsOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (editingId && editTitle.trim()) {
      onRenameConversation(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/80 bg-[#09090b] text-zinc-300 text-xs shrink-0 select-none">
      {/* Left Back Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors text-zinc-300 text-xs font-medium cursor-pointer"
          title="Back to Editor"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Center Navigation Pills */}
      <div className="flex items-center gap-1.5">
        {/* Chats Pill Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsChatsOpen((prev) => !prev);
              setIsPagesOpen(false);
              setIsCmsOpen(false);
            }}
            data-testid="conversation-title-btn"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors text-zinc-300 text-xs font-medium cursor-pointer max-w-[140px]"
            aria-expanded={isChatsOpen}
            aria-label="Select conversation"
          >
            <span className="truncate">{activeConversation?.title || "Chats"}</span>
            <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
          </button>

          {isChatsOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-1">
              <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400">
                <span>Conversations</span>
                <button
                  type="button"
                  onClick={() => {
                    onNewConversation();
                    setIsChatsOpen(false);
                  }}
                  data-testid="btn-new-chat"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {conversations.map((conv) => {
                  const isCurrent = conv.id === activeConversation?.id;
                  const isEditing = editingId === conv.id;

                  if (isEditing) {
                    return (
                      <div
                        key={conv.id}
                        className="flex items-center gap-1 p-1 bg-zinc-800 rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          data-testid="rename-conversation-input"
                          className="flex-1 bg-zinc-950 border border-zinc-700 px-2 py-1 text-xs rounded text-white outline-none focus:border-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={saveRename}
                          className="p-1 hover:text-white text-zinc-400"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="p-1 hover:text-white text-zinc-400"
                        >
                          <X className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setIsChatsOpen(false);
                      }}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isCurrent
                          ? "bg-zinc-800 text-white font-medium"
                          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{conv.title}</span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => startRename(conv, e)}
                          className="p-1 hover:text-white text-zinc-400 rounded"
                          title="Rename chat"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(conv.id);
                          }}
                          className="p-1 hover:text-rose-400 text-zinc-400 rounded"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pages Dropdown Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsPagesOpen((prev) => !prev);
              setIsChatsOpen(false);
              setIsCmsOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <Folder className="w-3 h-3 text-zinc-400" />
            <span>Pages - home</span>
            <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
          </button>

          {isPagesOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 border-b border-zinc-800">
                Document Pages
              </div>
              <button
                type="button"
                onClick={() => setIsPagesOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-white text-xs text-left"
              >
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                <span>home (index.html)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPagesOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 text-xs text-left"
              >
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>pricing (sections)</span>
              </button>
            </div>
          )}
        </div>

        {/* CMS Dropdown Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsCmsOpen((prev) => !prev);
              setIsChatsOpen(false);
              setIsPagesOpen(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors text-zinc-300 text-xs font-medium cursor-pointer"
          >
            <Database className="w-3 h-3 text-zinc-400" />
            <span>CMS</span>
            <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
          </button>

          {isCmsOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-0.5">
              <div className="px-2 py-1 text-[11px] font-semibold text-zinc-400 border-b border-zinc-800">
                Content Models
              </div>
              <button
                type="button"
                onClick={() => setIsCmsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800/60 text-xs text-left"
              >
                <span>Products & Catalog</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCmsOpen(false)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800/60 text-xs text-left"
              >
                <span>Design Tokens & Theme</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar Toggle Button */}
      <div className="flex items-center gap-1 mr-2 relative z-40">
        <button
          type="button"
          onClick={onToggleCollapse}
          data-testid="chat-collapse-btn"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Collapse chat sidebar"
          aria-label="Collapse chat sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-w-xs w-full space-y-3 shadow-2xl">
            <h3 className="font-semibold text-sm text-white">Delete this conversation?</h3>
            <p className="text-xs text-zinc-400">
              This will remove the chat history. Canonical document content will not be affected.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-2.5 py-1 rounded-md text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteConversation(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-2.5 py-1 rounded-md text-xs text-white bg-rose-600 hover:bg-rose-500 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
