"use client";

import React, { useState, useRef } from "react";
import { Sparkles, Send, X, AlertCircle, Loader2 } from "lucide-react";
import { AIEditScope } from "@/lib/ai/schemas";
import { SerializedNode } from "@/lib/bridge/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AIComposerProps {
  isOpen: boolean;
  selectedNode: SerializedNode | null;
  onClose: () => void;
  onSubmit: (instruction: string, scope: AIEditScope, signal?: AbortSignal) => Promise<void>;
}

export function AIComposer({
  isOpen,
  selectedNode,
  onClose,
  onSubmit,
}: AIComposerProps) {
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<AIEditScope>(selectedNode ? "selected_node" : "document");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!instruction.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await onSubmit(instruction.trim(), scope, controller.signal);
      setInstruction("");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Generation cancelled.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate edit proposal.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-4 text-zinc-900 dark:text-zinc-100 z-50 flex flex-col gap-3 transition-colors"
      data-testid="ai-composer-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-zinc-900 dark:text-zinc-100">
            Ask AI Editor
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6"
          aria-label="Close AI Composer"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Target Indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800">
        <span className="text-zinc-400 dark:text-zinc-500">Target:</span>
        {selectedNode ? (
          <span className="text-zinc-900 dark:text-zinc-200 font-semibold truncate max-w-[200px]">
            &lt;{selectedNode.tagName}&gt; #{selectedNode.id}
          </span>
        ) : (
          <span className="text-zinc-500">Entire Document</span>
        )}
      </div>

      {/* Scope Selector */}
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
          Scope
        </span>
        <div className="grid grid-cols-3 gap-1">
          {(
            [
              { id: "selected_node", label: "Element" },
              { id: "selected_section", label: "Section" },
              { id: "document", label: "Document" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                scope === s.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs font-semibold"
                  : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instruction Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "Make the hero headline larger" or "Change button text to Start free"'
          disabled={isLoading}
          data-testid="ai-instruction-input"
        />

        {error && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-400 font-mono">
            ⌘ + Enter to generate
          </span>

          <div className="flex gap-2">
            {isLoading && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}

            <Button
              type="submit"
              disabled={isLoading || !instruction.trim()}
              data-testid="btn-generate-ai-edit"
              size="sm"
              className="gap-1.5 font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Generate</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
