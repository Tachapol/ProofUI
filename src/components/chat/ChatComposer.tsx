"use client";

import React, { useState, useRef } from "react";
import {
  ArrowUp,
  Square,
  ChevronDown,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Layers,
  Target,
  PenLine,
  AtSign,
  X,
} from "lucide-react";
import { AIEditScope } from "@/lib/ai/schemas";
import { SerializedNode } from "@/lib/bridge/types";
import { ChatAttachment } from "@/lib/chat/schemas";
import { EditorDocumentContext } from "@/lib/editor/persistence";
import { validateAttachmentFile } from "@/lib/chat/attachment-validation";

interface ChatComposerProps {
  selectedNode: SerializedNode | null;
  documentRevision: number;
  documentContext?: EditorDocumentContext;
  isProcessing: boolean;
  currentStage?: string | null;
  onSendEdit: (instruction: string, scope: AIEditScope, attachments: ChatAttachment[]) => Promise<void>;
  onSendGenerate: (
    instruction: string,
    scope: "new_page" | "new_version",
    attachments: ChatAttachment[]
  ) => Promise<void>;
  onCancel: () => void;
  initialPrompt?: string;
}

export function ChatComposer({
  selectedNode,
  documentRevision,
  documentContext,
  isProcessing,
  onSendEdit,
  onSendGenerate,
  onCancel,
  initialPrompt = "",
}: ChatComposerProps) {
  const [instruction, setInstruction] = useState(initialPrompt);
  const [mode, setMode] = useState<"edit" | "generate">(() => (selectedNode ? "edit" : "generate"));
  const [editScope, setEditScope] = useState<AIEditScope>(() =>
    selectedNode ? "selected_node" : "document"
  );
  const [generateScope] = useState<"new_page" | "new_version">("new_version");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [selectedModel, setSelectedModel] = useState("GPT-5.6 Terra");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevPrompt, setPrevPrompt] = useState(initialPrompt);
  if (initialPrompt && initialPrompt !== prevPrompt) {
    setPrevPrompt(initialPrompt);
    setInstruction(initialPrompt);
  }

  const [prevNodeId, setPrevNodeId] = useState<string | null>(selectedNode?.id || null);
  const currentNodeId = selectedNode?.id || null;
  if (currentNodeId !== prevNodeId) {
    setPrevNodeId(currentNodeId);
    if (selectedNode) {
      if (mode !== "edit") setMode("edit");
      if (editScope !== "selected_node") setEditScope("selected_node");
    } else {
      if (editScope === "selected_node" || editScope === "selected_section") {
        setEditScope("document");
      }
    }
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!instruction.trim() || isProcessing) return;

    if (mode === "edit") {
      onSendEdit(instruction.trim(), editScope, attachments);
    } else {
      onSendGenerate(instruction.trim(), generateScope, attachments);
    }

    setInstruction("");
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const attachDesignDoc = () => {
    if (!documentContext?.designMarkdown) return;
    const att: ChatAttachment = {
      id: `att_dmd_${Date.now()}`,
      conversationId: "active",
      kind: "design-markdown",
      name: "DESIGN.md",
      mimeType: "text/markdown",
      size: documentContext.designMarkdown.length,
      createdAt: new Date().toISOString(),
      status: "ready",
      reference: {
        type: "import-artifact",
        capturePackageId: documentContext.capturePackageId || "imported",
        field: "designMarkdown",
      },
    };
    setAttachments((prev) => [...prev, att]);
  };

  const attachScreenshot = () => {
    if (!documentContext?.screenshotReference) return;
    const att: ChatAttachment = {
      id: `att_scr_${Date.now()}`,
      conversationId: "active",
      kind: "screenshot",
      name: "Screenshot.png",
      mimeType: "image/png",
      size: 1024 * 300,
      createdAt: new Date().toISOString(),
      status: "ready",
      reference: {
        type: "import-artifact",
        capturePackageId: documentContext.capturePackageId || "imported",
        field: "screenshot",
      },
    };
    setAttachments((prev) => [...prev, att]);
  };

  const attachCurrentDocument = () => {
    const att: ChatAttachment = {
      id: `att_doc_${Date.now()}`,
      conversationId: "active",
      kind: "current-document",
      name: `Context (Rev ${documentRevision})`,
      mimeType: "text/html",
      size: 1024 * 10,
      createdAt: new Date().toISOString(),
      status: "ready",
      reference: {
        type: "document",
        revision: documentRevision,
      },
    };
    setAttachments((prev) => [...prev, att]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const isImg = file.type.startsWith("image/");
      const att: ChatAttachment = {
        id: `att_file_${Date.now()}`,
        conversationId: "active",
        kind: isImg ? "screenshot" : "html-reference",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        createdAt: new Date().toISOString(),
        status: "ready",
        reference: {
          type: "uploaded-artifact",
          artifactId: `art_${Date.now()}`,
        },
      };
      setAttachments((prev) => [...prev, att]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-800/90 bg-[#121214] p-3 text-zinc-100 shadow-2xl relative space-y-2 select-none">
      {/* Hidden File Input for Paperclip */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp,text/markdown,text/html"
        onChange={handleFileUpload}
      />

      {/* Top Header: Mode Pill Toggle on the right */}
      <div className="flex items-center justify-between">
        {/* Active Target Indicator if editing element */}
        {selectedNode && mode === "edit" ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
            <Target className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="font-mono text-white font-medium">&lt;{selectedNode.tagName}&gt;</span>
            <span className="text-zinc-500">#{selectedNode.id.slice(0, 10)}</span>
          </div>
        ) : (
          <div />
        )}

        {/* Segmented Pill: [Generate | Edits] */}
        <div className="flex items-center bg-zinc-950/90 p-0.5 rounded-lg border border-zinc-800 ml-auto">
          <button
            type="button"
            onClick={() => setMode("generate")}
            data-testid="mode-tab-generate"
            className={`px-3 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === "generate"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Generate
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            data-testid="mode-tab-edit"
            className={`px-3 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              mode === "edit"
                ? "bg-zinc-800 text-white shadow-xs"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Edits
          </button>
        </div>
      </div>

      {/* Textarea Input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for revisions..."
          data-testid="ai-instruction-input"
          rows={3}
          disabled={isProcessing}
          className="w-full resize-none bg-transparent px-1 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none leading-relaxed select-text disabled:opacity-50"
        />
      </div>

      {/* Attachments Chips if any */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 py-1">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
            >
              <span>{att.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
        {/* Left Side: [✎] [GPT-5.6 Terra ⌄]   [@] [📎] [🖼] [📄] [⊞] [🎯] */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Edit Icon */}
          <button
            type="button"
            onClick={() => setMode("edit")}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title="Edit mode"
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>

          {/* Model Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors text-zinc-300 text-xs font-medium cursor-pointer"
            >
              <span>{selectedModel}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 flex flex-col gap-0.5">
                {["GPT-5.6 Terra", "Claude 3.7 Sonnet", "Mock Tailwind Engine"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                      selectedModel === m
                        ? "bg-zinc-800 text-white font-medium"
                        : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Attachment Icon Buttons */}
          <div className="flex items-center gap-0.5 text-zinc-400">
            {/* Mention Context */}
            <button
              type="button"
              onClick={attachCurrentDocument}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Attach Document Context (@)"
            >
              <AtSign className="w-3.5 h-3.5" />
            </button>

            {/* Paperclip */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Attach file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>

            {/* Image Screenshot */}
            <button
              type="button"
              disabled={!documentContext?.screenshotReference}
              onClick={attachScreenshot}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 transition-colors cursor-pointer"
              title="Attach Screenshot"
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>

            {/* Document DESIGN.md */}
            <button
              type="button"
              disabled={!documentContext?.designMarkdown}
              onClick={attachDesignDoc}
              className="p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 transition-colors cursor-pointer"
              title="Attach DESIGN.md"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Layers / Structure */}
            <button
              type="button"
              onClick={() => {
                if (mode === "edit") {
                  setEditScope(editScope === "selected_section" ? "document" : "selected_section");
                }
              }}
              className={`p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                editScope === "selected_section" ? "text-blue-400 bg-zinc-800" : ""
              }`}
              title="Scope to Section"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>

            {/* Target element */}
            <button
              type="button"
              disabled={!selectedNode}
              onClick={() => {
                setMode("edit");
                setEditScope("selected_node");
              }}
              className={`p-1.5 rounded-lg hover:text-white hover:bg-zinc-800/80 disabled:opacity-30 transition-colors cursor-pointer ${
                editScope === "selected_node" ? "text-blue-400 bg-zinc-800" : ""
              }`}
              title="Target Selected Element"
            >
              <Target className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Side: Circular Up Arrow Send Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isProcessing ? (
            <button
              type="button"
              onClick={onCancel}
              data-testid="btn-cancel-ai"
              className="w-8 h-8 rounded-full bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 flex items-center justify-center transition-colors cursor-pointer"
              title="Stop Generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!instruction.trim() || isProcessing}
              data-testid="btn-generate-ai-edit"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                instruction.trim()
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
              title="Send Prompt (Cmd+Enter)"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
