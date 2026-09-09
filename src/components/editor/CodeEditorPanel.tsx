"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Check, AlertCircle, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { CodeDiagnostic, CodeDraftState } from "@/lib/code/diagnostics";
import { validateHtmlSource } from "@/lib/code/code-validation";
import { formatHtml } from "@/lib/code/html-format";
import { Button } from "@/components/ui/button";

interface CodeEditorPanelProps {
  canonicalSource: string;
  revision: number;
  onApplyCodeChanges: (reconciledHtml: string) => void;
  onDraftChange?: (hasUnappliedChanges: boolean) => void;
  theme?: "light" | "dark";
  selectedId?: string | null;
  onCursorNodeChange?: (nodeId: string | null) => void;
  onCodeScroll?: (scrollPercentage: number) => void;
  externalScrollPercentage?: number | null;
}

export function CodeEditorPanel({
  canonicalSource,
  revision,
  onApplyCodeChanges,
  onDraftChange,
  theme = "dark",
  selectedId,
  onCursorNodeChange,
  onCodeScroll,
  externalScrollPercentage,
}: CodeEditorPanelProps) {
  const formattedCanonicalSource = useMemo(
    () => formatHtml(canonicalSource),
    [canonicalSource]
  );
  const [draftState, setDraftState] = useState<CodeDraftState>({
    value: formattedCanonicalSource,
    status: "clean",
    diagnostics: [],
    basedOnRevision: revision,
  });

  const [previousRevision, setPreviousRevision] = useState(revision);
  if (previousRevision !== revision) {
    setPreviousRevision(revision);
    if (draftState.status === "clean") {
      setDraftState((previous) => ({
        ...previous,
        value: formattedCanonicalSource,
        basedOnRevision: revision,
      }));
    }
  }

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorInstanceRef = useRef<any>(null);
  const isExternalScrollingRef = useRef(false);

  // Sync scroll from external preview
  useEffect(() => {
    if (externalScrollPercentage === undefined || externalScrollPercentage === null) return;
    const editor = editorInstanceRef.current;
    if (!editor) return;

    const scrollHeight = editor.getScrollHeight();
    const layoutInfo = editor.getLayoutInfo();
    const clientHeight = layoutInfo ? layoutInfo.height : 600;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      isExternalScrollingRef.current = true;
      editor.setScrollTop(externalScrollPercentage * maxScroll);
      setTimeout(() => {
        isExternalScrollingRef.current = false;
      }, 60);
    }
  }, [externalScrollPercentage]);

  // Reveal and highlight line in Monaco when selectedId changes from preview
  useEffect(() => {
    if (!selectedId) return;
    const editor = editorInstanceRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(
      `data-editor-id="${selectedId}"`,
      true,
      false,
      false,
      null,
      false
    );

    if (matches && matches.length > 0) {
      const match = matches[0];
      editor.revealLineInCenter(match.range.startLineNumber);
      editor.setPosition({
        lineNumber: match.range.startLineNumber,
        column: match.range.startColumn,
      });

      const decorations = [
        {
          range: new monaco.Range(
            match.range.startLineNumber,
            1,
            match.range.startLineNumber,
            model.getLineMaxColumn(match.range.startLineNumber)
          ),
          options: {
            isWholeLine: true,
            className: "bg-indigo-500/20 border-l-2 border-indigo-500",
            linesDecorationsClassName: "bg-indigo-500 w-1",
          },
        },
      ];
      editor.createDecorationsCollection(decorations);
    }
  }, [selectedId]);

  // Notify parent of unapplied changes status
  useEffect(() => {
    const hasUnapplied = draftState.status !== "clean" && draftState.value !== formattedCanonicalSource;
    onDraftChange?.(hasUnapplied);
  }, [draftState.status, draftState.value, formattedCanonicalSource, onDraftChange]);

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

    // Listen to cursor position to highlight node in preview
    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel();
      if (!model) return;
      const lineContent = model.getLineContent(e.position.lineNumber);
      const match = lineContent.match(/data-editor-id="([^"]+)"/);
      if (match) {
        onCursorNodeChange?.(match[1]);
      } else {
        // Search upward within 12 lines for enclosing opening tag
        let foundId: string | null = null;
        for (let l = e.position.lineNumber; l >= Math.max(1, e.position.lineNumber - 12); l--) {
          const content = model.getLineContent(l);
          const m = content.match(/<[a-zA-Z0-9-]+[^>]*data-editor-id="([^"]+)"/);
          if (m) {
            foundId = m[1];
            break;
          }
        }
        if (foundId) {
          onCursorNodeChange?.(foundId);
        }
      }
    });

    // Listen to scroll changes in Monaco to sync to preview iframe
    editor.onDidScrollChange((e) => {
      if (isExternalScrollingRef.current) return;
      const layout = editor.getLayoutInfo();
      const clientHeight = layout ? layout.height : 600;
      const maxScroll = e.scrollHeight - clientHeight;
      if (maxScroll > 0) {
        const pct = Math.min(1, Math.max(0, e.scrollTop / maxScroll));
        onCodeScroll?.(pct);
      }
    });

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
      value: formattedCanonicalSource,
      status: "clean",
      diagnostics: [],
      basedOnRevision: revision,
    });
    runValidation(formattedCanonicalSource);
  };

  const hasErrors = draftState.diagnostics.some((d) => d.severity === "error");
  const canApply = draftState.status === "valid" && draftState.value !== formattedCanonicalSource && !hasErrors;
  const isStale = draftState.basedOnRevision < revision;

  const handleFormatDraft = () => {
    const formatted = formatHtml(draftState.value);
    setDraftState((previous) => ({ ...previous, value: formatted, status: "validating" }));
    runValidation(formatted);
  };

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
          {draftState.value !== formattedCanonicalSource && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetDraft}
            >
              Reset Draft
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={handleFormatDraft} data-testid="btn-format-code">
            Format HTML
          </Button>

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
