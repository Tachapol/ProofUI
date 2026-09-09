"use client";

import React, { useState } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  Layers,
  X,
  ChevronRight,
  Undo2,
  Redo2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Eye,
  PenTool,
  Code2,
  Sparkles,
  Sun,
  Moon,
  Globe,
  History,
  Rocket,
  FolderKanban,
  Cloud,
  AlertCircle,
} from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { SerializedNode } from "@/lib/bridge/types";
import { VIEWPORT_PRESETS, ViewportMode } from "@/lib/editor/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type SaveStatus = "saved" | "unsaved" | "saving";
export type EditorMode = "preview" | "design" | "code";
export type ThemeMode = "light" | "dark";

interface ToolbarProps {
  viewport: ViewportMode;
  onViewportChange: (mode: ViewportMode) => void;
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  selectedId: string | null;
  selectedTagName: string | null;
  selectionPathNodes: SerializedNode[];
  onSelectNode: (id: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  projectName?: string;
  isCloudSynced?: boolean;
  hasConflict?: boolean;
  onOpenDashboard?: () => void;
  user?: { id: string; email: string; name: string } | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onResetDocument: () => void;
  onOpenAIComposer: () => void;
  onOpenImportDialog: () => void;
  onOpenVersionHistory?: () => void;
  onOpenOptimization?: () => void;
  onOpenPublish?: () => void;
  isLayersActive?: boolean;
  onToggleLayers?: () => void;
  isAIActive?: boolean;
  isOptimizationActive?: boolean;
  frameWidth?: number;
  frameHeight?: number;
  onWidthChange?: (width: number) => void;
  onHeightChange?: (height: number) => void;
  onAdjustWidth?: (delta: number) => void;
  onAdjustHeight?: (delta: number) => void;
  onResetFrameSize?: () => void;
}

export function Toolbar({
  viewport,
  onViewportChange,
  editorMode,
  onModeChange,
  theme,
  onToggleTheme,
  selectedId,
  selectedTagName,
  selectionPathNodes,
  onSelectNode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  projectName,
  isCloudSynced,
  hasConflict,
  onOpenDashboard,
  user,
  onOpenAuth,
  onLogout,
  onResetDocument,
  onOpenAIComposer,
  onOpenImportDialog,
  onOpenVersionHistory,
  onOpenOptimization,
  onOpenPublish,
  isLayersActive,
  onToggleLayers,
  isAIActive,
  isOptimizationActive,
  frameWidth,
  frameHeight,
  onWidthChange,
  onHeightChange,
  onAdjustWidth,
  onAdjustHeight,
  onResetFrameSize,
}: ToolbarProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  return (
    <header className="h-13 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur px-4 flex items-center justify-between text-sm select-none z-30 shrink-0 transition-colors">
      {/* Brand & Left Actions (Mode Switcher, Undo / Redo) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mr-1">
          <span className="w-6 h-6 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 text-xs shadow-xs">
            <Layers className="w-3.5 h-3.5" />
          </span>
          <span className="hidden sm:inline text-xs font-semibold">Visual HTML Editor</span>
        </div>

        {/* Project Switcher Trigger */}
        {onOpenDashboard && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDashboard}
            data-testid="toolbar-btn-dashboard"
            className="gap-1.5 text-xs font-medium border-zinc-200 dark:border-zinc-800 max-w-[160px] truncate"
            title="Open Project Dashboard"
          >
            <FolderKanban className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">{projectName || "Default Project"}</span>
          </Button>
        )}

        {/* Mode Switcher: Preview | Design | Code */}
        <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">
          <Button
            variant={editorMode === "preview" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("preview")}
            data-testid="mode-preview"
            className={
              editorMode === "preview"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </Button>

          <Button
            variant={editorMode === "design" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("design")}
            data-testid="mode-design"
            className={
              editorMode === "design"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Design</span>
          </Button>

          <Button
            variant={editorMode === "code" ? "default" : "ghost"}
            size="sm"
            onClick={() => onModeChange("code")}
            data-testid="mode-code"
            className={
              editorMode === "code"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Code</span>
          </Button>
        </div>

        {/* Undo / Redo Actions */}
        <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800 pl-2">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo last change"
            data-testid="toolbar-btn-undo"
          >
            <Undo2 className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo change"
            data-testid="toolbar-btn-redo"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Layers Tree Toggle (Visible in Design Mode) */}
        {editorMode === "design" && onToggleLayers && (
          <Button
            variant={isLayersActive ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleLayers}
            data-testid="toolbar-btn-layers"
            className={
              isLayersActive
                ? "gap-1.5 text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                : "gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            }
            title={isLayersActive ? "Collapse Layers Tree" : "Expand Layers Tree"}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Layers</span>
          </Button>
        )}

        {/* Save Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-500">
          {hasConflict ? (
            <Badge
              variant="destructive"
              data-testid="save-status-conflict"
              className="flex items-center gap-1 font-medium bg-red-600 text-white"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Conflict</span>
            </Badge>
          ) : saveStatus === "saved" ? (
            <Badge
              variant="success"
              data-testid="save-status-saved"
              className="flex items-center gap-1 font-medium"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{isCloudSynced ? "Cloud Saved" : "Saved"}</span>
            </Badge>
          ) : saveStatus === "unsaved" ? (
            <Badge
              variant="warning"
              data-testid="save-status-unsaved"
              className="flex items-center gap-1 font-medium"
            >
              <Clock className="w-3 h-3" />
              <span>Unsaved changes</span>
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              data-testid="save-status-saving"
              className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300 animate-pulse font-medium"
            >
              <Cloud className="w-3 h-3 text-indigo-500 animate-bounce" />
              <span>Saving...</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Center Viewport Switcher & Pixel Sizing (Visible in Preview & Design modes) */}
      {editorMode !== "code" && (
        <div className="flex items-center gap-1.5">
          {/* Viewport Presets */}
          <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-800">
            <Button
              variant={viewport === "desktop" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewportChange("desktop")}
              aria-label="Desktop viewport"
              data-testid="viewport-desktop"
              className={
                viewport === "desktop"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Desktop</span>
              <span className="text-[10px] opacity-70 ml-0.5">{VIEWPORT_PRESETS.desktop.label}</span>
            </Button>

            <Button
              variant={viewport === "tablet" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewportChange("tablet")}
              aria-label="Tablet viewport"
              data-testid="viewport-tablet"
              className={
                viewport === "tablet"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }
            >
              <Tablet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tablet</span>
              <span className="text-[10px] opacity-70 ml-0.5">{VIEWPORT_PRESETS.tablet.label}</span>
            </Button>

            <Button
              variant={viewport === "mobile" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewportChange("mobile")}
              aria-label="Mobile viewport"
              data-testid="viewport-mobile"
              className={
                viewport === "mobile"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mobile</span>
              <span className="text-[10px] opacity-70 ml-0.5">{VIEWPORT_PRESETS.mobile.label}</span>
            </Button>
          </div>

          {/* Frame Pixel Size Controls */}
          {frameWidth !== undefined && frameHeight !== undefined && (
            <div
              data-testid="frame-size-controls"
              className="hidden lg:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-mono"
            >
              {/* Width Controls */}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase select-none mr-0.5">W</span>
                <button
                  type="button"
                  onClick={(e) => onAdjustWidth?.(e.shiftKey ? -10 : -1)}
                  data-testid="btn-decrease-width"
                  title="Decrease width by 1px (Hold Shift for 10px)"
                  className="w-4 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  value={frameWidth}
                  onChange={(e) => onWidthChange?.(parseInt(e.target.value, 10) || 320)}
                  data-testid="frame-width-input"
                  className="w-13 h-5 text-center text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={320}
                  max={2560}
                />
                <button
                  type="button"
                  onClick={(e) => onAdjustWidth?.(e.shiftKey ? 10 : 1)}
                  data-testid="btn-increase-width"
                  title="Increase width by 1px (Hold Shift for 10px)"
                  className="w-4 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                >
                  +
                </button>
              </div>

              <span className="text-zinc-400 text-[11px] select-none">×</span>

              {/* Height Controls */}
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-zinc-400 font-semibold uppercase select-none mr-0.5">H</span>
                <button
                  type="button"
                  onClick={(e) => onAdjustHeight?.(e.shiftKey ? -10 : -1)}
                  data-testid="btn-decrease-height"
                  title="Decrease height by 1px (Hold Shift for 10px)"
                  className="w-4 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  value={frameHeight}
                  onChange={(e) => onHeightChange?.(parseInt(e.target.value, 10) || 400)}
                  data-testid="frame-height-input"
                  className="w-13 h-5 text-center text-xs bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={400}
                  max={3000}
                />
                <button
                  type="button"
                  onClick={(e) => onAdjustHeight?.(e.shiftKey ? 10 : 1)}
                  data-testid="btn-increase-height"
                  title="Increase height by 1px (Hold Shift for 10px)"
                  className="w-4 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                >
                  +
                </button>
              </div>

              <span className="text-[10px] text-zinc-400 select-none">px</span>

              {/* Reset to Preset Default */}
              {onResetFrameSize && (
                <button
                  type="button"
                  onClick={onResetFrameSize}
                  data-testid="btn-reset-frame-size"
                  title="Reset to preset default"
                  className="ml-0.5 p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right Actions: Import, Ask AI, Selection breadcrumb, Theme Switcher, Reset */}
      <div className="flex items-center gap-2">
        {/* Import Website Action */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenImportDialog}
          data-testid="toolbar-btn-import"
          className="gap-1.5 font-medium"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Import</span>
        </Button>

        {/* Version History Trigger */}
        {onOpenVersionHistory && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenVersionHistory}
            data-testid="toolbar-btn-history"
            className="gap-1.5 font-medium"
            title="View Document Version History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden md:inline">History</span>
          </Button>
        )}

        {/* Analyze UX Trigger */}
        {onOpenOptimization && (
          <Button
            variant={isOptimizationActive ? "default" : "outline"}
            size="sm"
            onClick={onOpenOptimization}
            data-testid="toolbar-btn-analyze-ux"
            className={
              isOptimizationActive
                ? "gap-1.5 font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
                : "gap-1.5 font-medium border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
            }
            title="Analyze UX Quality & Accessibility"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Analyze UX</span>
          </Button>
        )}

        {/* Publish & Deploy Trigger */}
        {onOpenPublish && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPublish}
            data-testid="toolbar-btn-publish"
            className="gap-1.5 font-medium border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            title="Publish & Deploy Document"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Publish</span>
          </Button>
        )}

        {/* Ask AI Trigger */}
        <Button
          variant={isAIActive ? "default" : "outline"}
          size="sm"
          onClick={onOpenAIComposer}
          data-testid="toolbar-btn-ask-ai"
          className={
            isAIActive
              ? "gap-1.5 font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-xs"
              : "gap-1.5 font-medium border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          }
          title={isAIActive ? "Close AI Assistant" : "Ask AI Assistant"}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask AI</span>
        </Button>

        {selectedId && editorMode === "design" ? (
          <div className="flex items-center gap-1.5">
            <div className="hidden xl:flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
              {selectionPathNodes.slice(-3).map((node, index, arr) => (
                <React.Fragment key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelectNode(node.id)}
                    className="hover:text-zinc-900 dark:hover:text-zinc-100 font-mono text-[11px] transition-colors cursor-pointer"
                  >
                    {node.tagName}
                  </button>
                  {index < arr.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>

            <Badge variant="tag" className="gap-1 px-2 py-0.5">
              <span className="font-bold uppercase">&lt;{selectedTagName}&gt;</span>
              <button
                type="button"
                onClick={() => onSelectNode(null)}
                aria-label="Clear selection"
                className="hover:text-zinc-900 dark:hover:text-zinc-100 ml-0.5 text-zinc-500 rounded p-0.5 transition-colors cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          </div>
        ) : null}

        {/* User Account Menu / Sign In */}
        {onOpenAuth && (
          <UserMenu
            user={user || null}
            onOpenAuth={onOpenAuth}
            onLogout={onLogout || (() => {})}
          />
        )}

        {/* Theme Toggle Button (Light / Dark) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          data-testid="theme-toggle"
          aria-label="Toggle light and dark theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-zinc-300 hover:text-white" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-700 hover:text-zinc-900" />
          )}
        </Button>

        {/* Reset Document Action */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowResetConfirm(true)}
          title="Reset to default document"
          data-testid="toolbar-btn-reset"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Confirmation Dialog for Reset */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Document to Sample?</DialogTitle>
            <DialogDescription>
              This will discard any unsaved changes and reset the document back to the original sample landing page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              data-testid="confirm-reset-button"
              onClick={() => {
                setShowResetConfirm(false);
                onResetDocument();
              }}
            >
              Yes, Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
