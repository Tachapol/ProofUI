"use client";

import React, { useState, useRef } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, Code, AlertCircle } from "lucide-react";
import { ChatAttachment } from "@/lib/chat/schemas";
import { EditorDocumentContext } from "@/lib/editor/persistence";
import { validateAttachmentFile } from "@/lib/chat/attachment-validation";
import { Button } from "@/components/ui/button";

interface AttachmentPickerProps {
  conversationId: string;
  attachments: ChatAttachment[];
  onAddAttachment: (att: ChatAttachment) => void;
  onRemoveAttachment: (id: string) => void;
  documentContext?: EditorDocumentContext;
  documentRevision: number;
}

export function AttachmentPicker({
  conversationId,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  documentContext,
  documentRevision,
}: AttachmentPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachDesignMarkdown = () => {
    if (!documentContext?.designMarkdown) return;
    const att: ChatAttachment = {
      id: `att_dmd_${Date.now()}`,
      conversationId,
      kind: "design-markdown",
      name: "DESIGN.md (Current)",
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
    onAddAttachment(att);
    setIsOpen(false);
  };

  const handleAttachScreenshot = () => {
    if (!documentContext?.screenshotReference) return;
    const att: ChatAttachment = {
      id: `att_scr_${Date.now()}`,
      conversationId,
      kind: "screenshot",
      name: "Captured Screenshot (Full Page)",
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
    onAddAttachment(att);
    setIsOpen(false);
  };

  const handleAttachCurrentDocument = () => {
    const att: ChatAttachment = {
      id: `att_doc_${Date.now()}`,
      conversationId,
      kind: "current-document",
      name: `Current Document (Rev ${documentRevision})`,
      mimeType: "text/html",
      size: 1024 * 15,
      createdAt: new Date().toISOString(),
      status: "ready",
      reference: {
        type: "document",
        revision: documentRevision,
      },
    };
    onAddAttachment(att);
    setIsOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const att: ChatAttachment = {
      id: `att_up_${Date.now()}`,
      conversationId,
      kind: validation.kind || "html-reference",
      name: validation.cleanName,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      status: "ready",
      reference: {
        type: "uploaded-artifact",
        artifactId: `up_${Date.now()}`,
      },
    };

    onAddAttachment(att);
    setIsOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      {/* Attached Chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-secondary text-secondary-foreground border border-border"
            >
              {att.kind === "screenshot" ? (
                <ImageIcon className="w-3 h-3 text-blue-500" />
              ) : att.kind === "design-markdown" ? (
                <FileText className="w-3 h-3 text-amber-500" />
              ) : (
                <Code className="w-3 h-3 text-emerald-500" />
              )}
              <span className="truncate max-w-[140px]">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                className="hover:text-destructive p-0.5 rounded-full"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error alert if upload failed */}
      {error && (
        <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto hover:opacity-80"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Trigger & Menu */}
      <div className="relative inline-block">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          data-testid="chat-attachment-picker-btn"
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
          title="Attach context or files"
        >
          <Paperclip className="w-3.5 h-3.5" />
          <span>Attach</span>
        </Button>

        {isOpen && (
          <div className="absolute left-0 bottom-full mb-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 p-1 space-y-0.5">
            {documentContext?.designMarkdown && (
              <button
                type="button"
                onClick={handleAttachDesignMarkdown}
                data-testid="attach-design-markdown-btn"
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-accent rounded"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Attach DESIGN.md</span>
              </button>
            )}

            {documentContext?.screenshotReference && (
              <button
                type="button"
                onClick={handleAttachScreenshot}
                data-testid="attach-screenshot-btn"
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-accent rounded"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Attach Screenshot</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAttachCurrentDocument}
              data-testid="attach-current-document-btn"
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-accent rounded"
            >
              <Code className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">Attach Document HTML</span>
            </button>

            <div className="border-t border-border my-1" />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="attach-upload-file-btn"
              className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-accent rounded"
            >
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">Upload File (.png, .md, .html)...</span>
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.md,.html"
          onChange={handleFileUpload}
          className="hidden"
          aria-label="Upload reference file"
        />
      </div>
    </div>
  );
}
