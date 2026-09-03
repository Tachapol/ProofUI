"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Check, AlertCircle, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { CodeDiagnostic, CodeDraftState } from "@/lib/code/diagnostics";
import { validateHtmlSource } from "@/lib/code/code-validation";
import { Button } from "@/components/ui/button";

interface CodeEditorPanelProps {
  canonicalSource: string;
  revision: number;
  onApplyCodeChanges: (reconciledHtml: string) => void;
  onDraftChange?: (hasUnappliedChanges: boolean) => void;
  theme?: "light" | "dark";
}

export function CodeEditorPanel({
  canonicalSource,
  revision,
  onApplyCodeChanges,
  onDraftChange,
  theme = "dark",
}: CodeEditorPanelProps) {
  const [draftState, setDraftState] = useState<CodeDraftState>({
    value: canonicalSource,
    status: "clean",
    diagnostics: [],
    basedOnRevision: revision,
  });

  const [prevRevision, setPrevRevision] = useState(revision);
  if (prevRevision !== revision) {
    setPrevRevision(revision);
    if (draftState.status === "clean") {
      setDraftState((prev) => ({
        ...prev,
        value: canonicalSource,
        basedOnRevision: revision,
      }));
    }
  }

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorInstanceRef = useRef<any>(null);

  // Notify parent of unapplied changes status
  useEffect(() => {
    const hasUnapplied = draftState.status !== "clean" && draftState.value !== canonicalSource;
    onDraftChange?.(hasUnapplied);
  }, [draftState.status, draftState.value, canonicalSource, onDraftChange]);

  // Validation function
  const runValidation = useCallback((code: string) => {
    const result = validateHtmlSource(code);
    setDraftState((prev) => ({
      ...prev,
      status: result.isValid ? "valid" : "invalid",
      diagnostics: result.diagnostics,
    }));

    // Update Monaco editor markers
    if (monacoRef.current && editorInstanceRef.current) {
      const model = editorInstanceRef.current.getModel();
      if (model) {
        const markers = result.diagnostics.map((d: CodeDiagnostic) => ({
          severity:
            d.severity === "error"
              ? monacoRef.current.MarkerSeverity.Error
              : monacoRef.current.MarkerSeverity.Warning,
          message: d.message,
          startLineNumber: d.line,
          startColumn: d.column,
          endLineNumber: d.line,
          endColumn: d.column + (d.length || 10),
        }));
        monacoRef.current.editor.setModelMarkers(model, "owner", markers);
      }
    }
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    const nextVal = value || "";
    setDraftState((prev) => ({
      ...prev,
      value: nextVal,
      status: "validating",
    }));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      runValidation(nextVal);
    }, 450);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monacoRef.current = monaco;
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__monacoEditor = editor;
    }
    runValidation(draftState.value);
  };

  const handleApply = () => {
    if (draftState.status === "invalid") return;
    onApplyCodeChanges(draftState.value);
    setDraftState((prev) => ({
      ...prev,
      status: "clean",
      basedOnRevision: revision + 1,
    }));
  };

  const handleResetDraft = () => {
    setDraftState({
      value: canonicalSource,
      status: "clean",
      diagnostics: [],
      basedOnRevision: revision,
    });
    runValidation(canonicalSource);
  };

  const hasErrors = draftState.diagnostics.some((d) => d.severity === "error");
  const canApply = draftState.status === "valid" && draftState.value !== canonicalSource && !hasErrors;
  const isStale = draftState.basedOnRevision < revision;

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors" data-testid="code-editor-panel">
      {/* Code Mode Action Bar */}
      <div className="h-11 px-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">HTML Source Code</span>
          <div className="flex items-center gap-2">
            {draftState.status === "validating" && (
              <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Validating...</span>
              </span>
            )}
            {draftState.status === "valid" && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                <Check className="w-3 h-3" />
                <span>Valid HTML</span>
              </span>
            )}
            {draftState.status === "invalid" && (
              <span className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-mono" data-testid="code-status-invalid">
                <AlertCircle className="w-3 h-3" />
                <span>{draftState.diagnostics.filter((d) => d.severity === "error").length} Errors</span>
              </span>
            )}
            {isStale && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                <span>Document updated in visual editor</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {draftState.value !== canonicalSource && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDraft}
            >
              Reset Draft
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            disabled={!canApply}
            onClick={handleApply}
            data-testid="btn-apply-code"
            className="gap-1.5 font-medium"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Apply Code Changes</span>
          </Button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="html"
          theme={theme === "light" ? "vs" : "vs-dark"}
          value={draftState.value}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Diagnostics Footer Bar */}
      {draftState.diagnostics.length > 0 && (
        <div
          className="max-h-36 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2.5 overflow-y-auto custom-scrollbar shrink-0 space-y-1.5"
          data-testid="code-diagnostics-panel"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Diagnostics ({draftState.diagnostics.length})
          </div>
          {draftState.diagnostics.map((diag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs font-mono p-1.5 rounded ${
                diag.severity === "error"
                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
              }`}
            >
              {diag.severity === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-bold mr-1.5">[{diag.line}:{diag.column}]</span>
                <span>{diag.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
